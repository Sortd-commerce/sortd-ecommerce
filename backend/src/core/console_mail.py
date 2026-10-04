"""Console mailer that prints the readable body, not raw MIME."""

import sys
import threading

from django.core.mail.backends.base import BaseEmailBackend


class EmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        self.stream = kwargs.pop("stream", sys.stdout)
        self._lock = threading.RLock()
        super().__init__(**kwargs)
        self.fail_silently = fail_silently

    def write_message(self, message):
        recipients = ", ".join(message.to)
        self.stream.write(f"Subject: {message.subject}\n")
        self.stream.write(f"To: {recipients}\n")
        self.stream.write(f"From: {message.from_email}\n\n")
        self.stream.write(message.body)
        self.stream.write("\n")
        self.stream.write("-" * 79)
        self.stream.write("\n")

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        msg_count = 0
        with self._lock:
            try:
                for message in email_messages:
                    self.write_message(message)
                    self.stream.flush()
                    msg_count += 1
            except Exception:
                if not self.fail_silently:
                    raise
        return msg_count
