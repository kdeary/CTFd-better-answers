from CTFd.models import db, Challenges

class BetterAnswersChallenge(Challenges):
    __mapper_args__ = {"polymorphic_identity": "better_answers"}
    id = db.Column(None, db.ForeignKey("challenges.id"), primary_key=True)

    def __init__(self, *args, **kwargs):
        super(BetterAnswersChallenge, self).__init__(**kwargs)

class BetterAnswersQuestion(db.Model):
    __tablename__ = "better_answers_questions"
    id = db.Column(db.Integer, primary_key=True)
    challenge_id = db.Column(db.Integer, db.ForeignKey("challenges.id"))
    title = db.Column(db.Text)
    description = db.Column(db.Text)
    answer = db.Column(db.Text)
    points = db.Column(db.Integer, default=0)
    max_attempts = db.Column(db.Integer, default=0)
    # UI class (TEXT, IPv4, etc)
    category = db.Column(db.String(80))

class BetterAnswersSubmission(db.Model):
    __tablename__ = "better_answers_submissions"
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey("better_answers_questions.id"))
    challenge_id = db.Column(db.Integer, db.ForeignKey("challenges.id"))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id"))
    ip = db.Column(db.String(46))
    provided = db.Column(db.Text)
    correct = db.Column(db.Boolean, default=False)
    date = db.Column(db.DateTime, default=db.func.now())
