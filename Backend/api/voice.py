import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app as flask_app  # noqa: E402


class StripVoicePrefix:
    def __init__(self, wrapped_app):
        self.wrapped_app = wrapped_app

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        if path.startswith("/voice"):
            environ["SCRIPT_NAME"] = f'{environ.get("SCRIPT_NAME", "")}/voice'
            environ["PATH_INFO"] = path[len("/voice") :] or "/"
        return self.wrapped_app(environ, start_response)


app = StripVoicePrefix(flask_app)
