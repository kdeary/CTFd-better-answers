from flask import Blueprint, request, jsonify
from CTFd.plugins import register_plugin_assets_directory
from CTFd.plugins.challenges import CHALLENGE_CLASSES, BaseChallenge
from CTFd.models import db, Solves, Awards, Challenges, Flags, Submissions
from CTFd.utils.user import get_current_user, get_current_team
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
        "create": f"/plugins/better-answers/assets/create.js",
        "update": f"/plugins/better-answers/assets/update.js",
        "view": f"/plugins/better-answers/assets/view.js",
    }

    @classmethod
    def get_plugin_name(cls):
        return __name__.split('.')[-1]

    @staticmethod
    def create(request):
        data = request.form or request.get_json()
        challenge = BetterAnswersChallenge(**data)
        db.session.add(challenge)
        db.session.commit()
        return challenge

    @classmethod
    def read(cls, challenge):
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
        
        q_list = []
        default_pts = challenge.value // len(flags) if len(flags) > 0 else 0
        
        correct_submissions = Submissions.query.filter_by(
            challenge_id=challenge.id,
            user_id=user_id,
            team_id=team_id,
            type="correct"
        ).all()
        correct_provided = [s.provided for s in correct_submissions]
        
        for i, flag in enumerate(flags):
            flag_class = get_flag_class(flag.type)
            solved_provided = ""
            for prov in correct_provided:
                try:
                    if flag_class.compare(flag, prov):
                        solved_provided = prov
                        break
                except:
                    pass
            
            pts = flag_points_list[i] if i < len(flag_points_list) else default_pts

            q_list.append({
                "id": flag.id,
                "title": f"Q{i+1}",
                "description": "",
                "points": pts,
                "solved": bool(solved_provided),
                "provided": solved_provided
            })

        data = {
            "id": challenge.id,
            "name": challenge.name,
            "value": challenge.value,
            "description": challenge.description,
            "category": challenge.category,
            "state": challenge.state,
            "max_attempts": challenge.max_attempts,
            "type": challenge.type,
            "type_data": {
                "id": cls.id,
                "name": cls.name,
                "templates": cls.templates,
                "scripts": cls.scripts,
            },
            "questions": q_list,
            "flag_points": challenge.flag_points
        }
        return data

    @staticmethod
    def update(challenge, request):
        data = request.form or request.get_json()
        for key, value in data.items():
            setattr(challenge, key, value)
        db.session.commit()
        return challenge

    @staticmethod
    def delete(challenge):
        BetterAnswersChallenge.query.filter_by(id=challenge.id).delete()
        Challenges.query.filter_by(id=challenge.id).delete()
        db.session.commit()

    @staticmethod
    def attempt(challenge, request):
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

        # Check for previous solves using core Submissions
        correct_submissions = Submissions.query.filter_by(
            challenge_id=challenge.id,
            user_id=user_id,
            team_id=team_id,
            type="correct"
        ).all()
        correct_provided = [s.provided for s in correct_submissions]
        
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
            flags = Flags.query.filter_by(challenge_id=challenge.id).order_by(Flags.id).all()
            flag_points_list = []
            if challenge.flag_points:
                try:
                    flag_points_list = [int(p.strip()) for p in challenge.flag_points.split(',')]
                except:
                    pass
            default_pts = challenge.value // len(flags) if len(flags) > 0 else 0
            
            pts = default_pts
            for i, f in enumerate(flags):
                if f.id == flag.id:
                    pts = flag_points_list[i] if i < len(flag_points_list) else default_pts
                    idx = i + 1
                    break

            # Award partial points
            award = Awards(
                user_id=user_id,
                team_id=team_id,
                name=f"Partial Credit: {challenge.name} - Q{idx}",
                value=pts,
                category="Challenge"
            )
            db.session.add(award)
            db.session.commit()

            # Check if all flags found (Including this new valid submission, so + 1)
            total_flags = Flags.query.filter_by(challenge_id=challenge.id).count()
            
            # Count unique flags solved by counting matches against correct_provided
            solved_flags_count = 0
            all_flags = Flags.query.filter_by(challenge_id=challenge.id).all()
            for f in all_flags:
                f_class = get_flag_class(f.type)
                for prov in correct_provided:
                    try:
                        if f_class.compare(f, prov):
                            solved_flags_count += 1
                            break
                    except:
                        pass
            
            # Add 1 for the currently checked correct submission
            if solved_flags_count + 1 >= total_flags:
                Awards.query.filter(
                    Awards.user_id == user_id,
                    Awards.team_id == team_id,
                    Awards.name.like(f"Partial Credit: {challenge.name} - Q%")
                ).delete(synchronize_session='fetch')
                
                db.session.commit()
                return True, "Correct! Challenge fully solved."

            return True, "Correct!"
        else:
            return False, "Incorrect"

    @staticmethod
    def solve(user, team, challenge, request):
        user_id = user.id if user else None
        team_id = team.id if team else None

        total_flags = Flags.query.filter_by(challenge_id=challenge.id).count()
        correct_submissions = Submissions.query.filter_by(
            challenge_id=challenge.id,
            user_id=user_id,
            team_id=team_id,
            type="correct"
        ).all()
        correct_provided = [s.provided for s in correct_submissions]
        
        data = request.form or request.get_json()
        current_submission = data.get("submission", "").strip()
        if current_submission:
            correct_provided.append(current_submission)

        solved_flags_count = 0
        all_flags = Flags.query.filter_by(challenge_id=challenge.id).all()
        for f in all_flags:
            f_class = get_flag_class(f.type)
            for prov in correct_provided:
                try:
                    if f_class.compare(f, prov):
                        solved_flags_count += 1
                        break
                except:
                    pass
        
        if solved_flags_count >= total_flags:
            # Actually solved! Let core handle it.
            BaseChallenge.solve(user, team, challenge, request)
        else:
            # Partial solve, do not create a generic `Solves` record!
            pass

    @staticmethod
    def fail(user, team, challenge, request):
        BaseChallenge.fail(user, team, challenge, request)

def load(app):
    app.db.create_all()
    plugin_name = __name__.split('.')[-1]
    CHALLENGE_CLASSES["better_answers"] = BetterAnswersChallengeType
    register_plugin_assets_directory(app, base_path=f"/plugins/{plugin_name}/assets/")
