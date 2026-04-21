import time
from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy import inspect, text
from CTFd.exceptions.challenges import ChallengeUpdateException
from CTFd.plugins import register_plugin_assets_directory
from CTFd.plugins.challenges import CHALLENGE_CLASSES, BaseChallenge
from CTFd.models import db, Solves, Awards, Challenges, Flags, Submissions, Fails
from CTFd.utils.user import get_current_user, get_current_team, get_ip
from CTFd.utils import user as user_utils
from CTFd.plugins.flags import get_flag_class
from .models import BetterAnswersChallenge

class BetterAnswersChallengeType(BaseChallenge):
    id = "better_answers"
    name = "better_answers"
    challenge_model = BetterAnswersChallenge

    templates = {
        "create": f"/plugins/better-answers/assets/create.html",
        "update": f"/plugins/better-answers/assets/update.html",
        "view": f"/plugins/better-answers/assets/view.html",
    }
    scripts = {
        "create": f"/plugins/better-answers/assets/create.js?v=5",
        "update": f"/plugins/better-answers/assets/update.js?v=5",
        "view": f"/plugins/better-answers/assets/view.js?v=12",
    }

    @classmethod
    def get_plugin_name(cls):
        return __name__.split('.')[-1]

    @classmethod
    def _get_correct_provided(cls, challenge_id, user_id, team_id):
        # Helper to get deduplicated list of provided answers from both Submissions and Awards metadata
        subs = Submissions.query.filter_by(
            challenge_id=challenge_id,
            user_id=user_id,
            team_id=team_id,
            type="correct"
        ).all()
        
        # Query awards that were given for this specific challenge
        awards = Awards.query.filter_by(
            user_id=user_id,
            team_id=team_id
        ).all()
        
        provided = [s.provided for s in subs]
        
        for a in awards:
            if a.requirements and isinstance(a.requirements, dict):
                if a.requirements.get('challenge_id') == challenge_id:
                    ans = a.requirements.get('provided')
                    if ans:
                        provided.append(ans)
        
        return list(set(provided))

    @classmethod
    def _get_fail_counts(cls, challenge_id, user_id, team_id):
        # Helper to count failures per question by parsing [flag_id:X] markers in the Fails table
        fails = Fails.query.filter_by(
            challenge_id=challenge_id,
            user_id=user_id,
            team_id=team_id
        ).all()
        
        counts = {} # flag_id -> count
        for f in fails:
            if f.provided and f.provided.startswith('[flag_id:'):
                try:
                    # Extract ID from "[flag_id:123] answer"
                    fid_str = f.provided.split(']')[0].split(':')[1]
                    fid = int(fid_str)
                    counts[fid] = counts.get(fid, 0) + 1
                except (IndexError, ValueError):
                    pass
        return counts

    @classmethod
    def create(cls, request):
        data = request.form or request.get_json()
        challenge = cls.challenge_model(**data)
        db.session.add(challenge)
        db.session.commit()
        return challenge

    @classmethod
    def read(cls, challenge):
        db.session.expire_all()
        data = super().read(challenge)
        try:
            user = get_current_user()
            team = get_current_team()
            user_id = user.id if user else None
            team_id = team.id if team else None

            flags = Flags.query.filter_by(challenge_id=challenge.id).order_by(Flags.id).all()
            
            # parse custom points
            flag_points_list = []
            if challenge.flag_points:
                try:
                    flag_points_list = [int(p.strip()) for p in challenge.flag_points.split(',')]
                except:
                    pass
            
            default_pts = (challenge.value or 0) // len(flags) if len(flags) > 0 else 0
            
            # Check for successes via Awards and fails via Fails table
            user_awards = Awards.query.filter_by(user_id=user_id, team_id=team_id).all()
            correct_provided = []
            
            for a in user_awards:
                if a.requirements and isinstance(a.requirements, dict):
                    if a.requirements.get('challenge_id') == challenge.id:
                        correct_provided.append(a.requirements.get('provided'))

            # Standard correct submissions (Solves)
            correct_submissions = Submissions.query.filter_by(
                challenge_id=challenge.id,
                user_id=user_id,
                team_id=team_id,
                type="correct"
            ).all()
            correct_provided += [s.provided for s in correct_submissions]
            correct_provided = list(set(correct_provided))

            # Get fail counts from the native Fails table
            fail_counts = cls._get_fail_counts(challenge.id, user_id, team_id)

            # Parse attempts
            flag_attempts_list = []
            if challenge.flag_attempts:
                try:
                    flag_attempts_list = [int(a.strip()) for a in challenge.flag_attempts.split(',')]
                except:
                    pass

            q_list = []
            for i, flag in enumerate(flags):
                flag_class = get_flag_class(flag.type)
                solved = False
                provided = None
                for prov in correct_provided:
                    try:
                        if flag_class.compare(flag, prov):
                            solved = True
                            provided = prov
                            break
                    except:
                        pass
                
                pts = flag_points_list[i] if i < len(flag_points_list) else default_pts
                max_att = flag_attempts_list[i] if i < len(flag_attempts_list) else 0
                curr_att = fail_counts.get(flag.id, 0)
                if solved:
                    curr_att += 1

                q_list.append({
                    "id": flag.id,
                    "title": f"Q{i+1}",
                    "points": pts,
                    "solved": solved,
                    "provided": provided,
                    "attempts": curr_att,
                    "max_attempts": max_att
                })
            
            data.update({
                "questions": q_list,
                "flag_points": challenge.flag_points
            })
        except Exception as e:
            # Prevent 500 error on challenge load if extra logic fails
            db.session.rollback()
            print(f"Error in BetterAnswers.read(): {e}")
        return data

    @classmethod
    def update(cls, challenge, request):
        data = request.form or request.get_json()
        
        if "flag_points" in data and data["flag_points"].strip() != "":
            flag_points = data["flag_points"]
            points_count = len([p for p in flag_points.split(",") if p.strip() != ""])
            flag_count = Flags.query.filter_by(challenge_id=challenge.id).count()
            
            if points_count > flag_count:
                raise ChallengeUpdateException(
                    f"You have defined points for {points_count} questions, but this challenge only has {flag_count} flags. Please add more flags first."
                )

        return super().update(challenge, request)

    @classmethod
    def delete(cls, challenge):
        # Clean up partial awards manually by checking the requirements metadata
        awards = Awards.query.all()
        for a in awards:
            if a.requirements and isinstance(a.requirements, dict):
                if a.requirements.get('challenge_id') == challenge.id:
                    db.session.delete(a)
        
        # Also handle old naming convention for safety during transition
        Awards.query.filter(
            Awards.name.like(f"Partial Credit: % (ID: {challenge.id}) - Q%")
        ).delete(synchronize_session='fetch')
        
        Awards.query.filter(
            Awards.name.like(f"Partial Credit: {challenge.name} - Q%")
        ).delete(synchronize_session='fetch')
        
        db.session.commit()
        return super().delete(challenge)

    @classmethod
    def attempt(cls, challenge, request):
        data = request.form or request.get_json()
        submission = data.get("submission", "").strip()
        flag_id = data.get("question_id") # frontend sends 'question_id' but it corresponds to flag.id
        
        if not flag_id:
            return False, "Missing flag ID"

        flag = Flags.query.filter_by(id=flag_id, challenge_id=challenge.id).first()
        if not flag:
            return False, "Flag not found"

        user = get_current_user()
        team = get_current_team()
        user_id = user.id if user else None
        team_id = team.id if team else None

        # PRE-SOLVE CHECK: Do not allow any submissions if already solved
        if Solves.query.filter_by(challenge_id=challenge.id, user_id=user_id, team_id=team_id).first():
            return False, "This challenge is already solved!"

        # Check Attempt Limit for this specific question
        flag_attempts_list = []
        if challenge.flag_attempts:
            try:
                flag_attempts_list = [int(a.strip()) for a in challenge.flag_attempts.split(',')]
            except:
                pass
        
        # Find this flag's position to get its specific limit
        flags = Flags.query.filter_by(challenge_id=challenge.id).order_by(Flags.id).all()
        flag_idx = -1
        for i, f in enumerate(flags):
            if f.id == flag.id:
                flag_idx = i
                break
        
        max_atts = flag_attempts_list[flag_idx] if flag_idx != -1 and flag_idx < len(flag_attempts_list) else 0
        if max_atts > 0:
            # Count previous failures using the helper
            fail_counts = cls._get_fail_counts(challenge.id, user_id, team_id)
            total_fails = fail_counts.get(flag.id, 0)
            
            if total_fails >= max_atts:
                return False, f"Max attempts reached for this question ({max_atts}/{max_atts})"

        # Check both Submissions and Awards metadata to prevent duplicate awards
        correct_provided = cls._get_correct_provided(challenge.id, user_id, team_id)
        
        flag_class = get_flag_class(flag.type)
        for prov in correct_provided:
            try:
                if flag_class.compare(flag, prov):
                    return False, "Already solved"
            except:
                pass

        # Check answer
        try:
            is_correct = flag_class.compare(flag, submission)
        except Exception:
            is_correct = False
        
        if is_correct:
            # Figure out points for this flag
            flag_points_list = []
            if challenge.flag_points:
                try:
                    flag_points_list = [int(p.strip()) for p in challenge.flag_points.split(',')]
                except:
                    pass
            default_pts = (challenge.value or 0) // len(flags) if len(flags) > 0 else 0
            
            pts = default_pts
            if flag_idx != -1:
                pts = flag_points_list[flag_idx] if flag_idx < len(flag_points_list) else default_pts
                idx = flag_idx + 1

            # Award partial points with unique metadata in requirements
            award = Awards(
                user_id=user_id,
                team_id=team_id,
                name=f"Partial Credit: {challenge.name} (ID: {challenge.id}) - Q{idx}",
                value=pts,
                category="Challenge",
                requirements={
                    "challenge_id": challenge.id,
                    "flag_id": flag.id,
                    "provided": submission
                }
            )
            db.session.add(award)
            db.session.commit()

            # Check if all flags found
            total_flags = len(flags)
            
            # Count unique flags solved by checking Awards metadata
            solved_flags_count = 0
            user_awards = Awards.query.filter_by(user_id=user_id, team_id=team_id).all()
            for a in user_awards:
                if a.requirements and isinstance(a.requirements, dict):
                    if a.requirements.get('challenge_id') == challenge.id:
                        solved_flags_count += 1
            
            if solved_flags_count >= total_flags:
                return True, "Correct! You have fully solved the challenge."

            return True, "Correct!"
        else:
            return False, (f"Incorrect (Submission Time: {datetime.fromtimestamp(time.time())})")

    @classmethod
    def fail(cls, user, team, challenge, request):
        data = request.form or request.get_json()
        submission = data["submission"].strip()
        flag_id = data.get("question_id")
        # Check if limit is already reached
        user_id = user.id
        team_id = team.id if team else None
        current_fails = cls._get_fail_counts(challenge.id, user_id, team_id)
        max_attempts_dict = {}
        if challenge.flag_attempts:
            try:
                for i, att in enumerate(challenge.flag_attempts.split(',')):
                    max_attempts_dict[i + 1] = int(att.strip())
            except:
                pass
        
        limit = max_attempts_dict.get(flag_id, 0)
        if limit > 0 and current_fails.get(flag_id, 0) >= limit:
            print(f"[BetterAnswers] Limit reached for flag {flag_id}, ignoring attempt.")
            return

        if flag_id:
            submission = f"[flag_id:{flag_id}] {submission}"
            
        wrong = Fails(
            user_id=user.id,
            team_id=team.id if team else None,
            challenge_id=challenge.id,
            ip=get_ip(request),
            provided=submission,
        )
        db.session.add(wrong)
        db.session.commit()
        print(f"[BetterAnswers] Recorded fail for flag {flag_id}")

    @classmethod
    def solve(cls, user, team, challenge, request):
        user_id = user.id if user else None
        team_id = team.id if team else None

        total_flags = Flags.query.filter_by(challenge_id=challenge.id).count()
        
        # Count solved questions via Awards
        solved_flags_count = 0
        user_awards = Awards.query.filter_by(user_id=user_id, team_id=team_id).all()
        for a in user_awards:
            if a.requirements and isinstance(a.requirements, dict):
                if a.requirements.get('challenge_id') == challenge.id:
                    solved_flags_count += 1
        
        data = request.form or request.get_json()
        current_submission = data.get("submission", "").strip()
        # If the last flag is correct, solved_flags_count will be total_flags - 1?
        # No, attempt() already created the award!
        # But wait, CTFd calls attempt() then solve(). attempt() already committed the award.
        # So solve() should see it if committed.

        if solved_flags_count >= total_flags:
            # Actually solved! 
            # 1. Clean up partial awards manually by checking the requirements metadata
            for a in user_awards:
                if a.requirements and isinstance(a.requirements, dict):
                    if a.requirements.get('challenge_id') == challenge.id:
                        db.session.delete(a)
            
            db.session.commit()

            # 2. Let core handle the final Solves record
            super().solve(user, team, challenge, request)
        else:
            # Partial solve, do not create a generic `Solves` record!
            pass


def load(app):
    app.db.create_all()
    
    # Manual Migration for SQLite to ensure required columns exist
    try:
        from sqlalchemy import inspect as sqla_inspect
        inspector = sqla_inspect(db.engine)
        if 'better_answers_challenge' in inspector.get_table_names():
            columns = [c['name'] for c in inspector.get_columns('better_answers_challenge')]
            
            if 'flag_points' not in columns:
                db.session.execute(text('ALTER TABLE better_answers_challenge ADD COLUMN flag_points TEXT DEFAULT ""'))
                db.session.commit()
                print("SUCCESS: Added column flag_points to better_answers_challenge")
                
            if 'flag_attempts' not in columns:
                db.session.execute(text('ALTER TABLE better_answers_challenge ADD COLUMN flag_attempts TEXT'))
                db.session.commit()
                print("SUCCESS: Added column flag_attempts to better_answers_challenge")
    except Exception as e:
        print(f"Migration error: {e}")
        db.session.rollback()

    plugin_name = __name__.split('.')[-1]
    CHALLENGE_CLASSES["better_answers"] = BetterAnswersChallengeType
    register_plugin_assets_directory(app, base_path=f"/plugins/{plugin_name}/assets/")
