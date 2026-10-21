from flask import Flask, redirect, render_template, url_for

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("dice.html", active="dice")


@app.route("/dice")
def dice():
    return render_template("dice.html", active="dice")


@app.route("/machine")
def machine():
    return redirect(url_for("machine_day"))


@app.route("/machine/day")
def machine_day():
    return render_template("machine.html", active="machine", phase="day")


@app.route("/machine/night")
def machine_night():
    return render_template("machine.html", active="machine", phase="night")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
