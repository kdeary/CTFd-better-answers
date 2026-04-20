from CTFd.models import db, Challenges

class BetterAnswersChallenge(Challenges):
    __mapper_args__ = {"polymorphic_identity": "better_answers"}
    id = db.Column(db.Integer, db.ForeignKey("challenges.id", ondelete="CASCADE"), primary_key=True)
    flag_points = db.Column(db.Text, default="")
    flag_attempts = db.Column(db.Text)
