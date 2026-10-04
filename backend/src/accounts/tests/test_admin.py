from django.contrib.auth import get_user_model
from django.test import TestCase

from accounts.forms import AccountChangeForm, AccountCreationForm
from accounts.tests.helpers import PASSWORD

User = get_user_model()


class AdminUserTests(TestCase):
    def test_admin_creation_form_saves_an_email_user(self):
        form = AccountCreationForm(
            {
                "email": "Admin-Made@Example.com",
                "password1": PASSWORD,
                "password2": PASSWORD,
                "usable_password": "true",
            }
        )

        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertEqual(user.email, "admin-made@example.com")
        self.assertTrue(user.check_password(PASSWORD))

    def test_admin_change_form_edits_the_profile(self):
        user = User.objects.create_user(email="ada@example.com", password=PASSWORD)
        form = AccountChangeForm(
            data={
                "email": "ada@example.com",
                "first_name": "Ada",
                "last_name": "Lovelace",
                "is_active": True,
                "is_staff": False,
                "is_superuser": False,
                "date_joined": user.date_joined,
                "last_login": "",
                "password": user.password,
                "phone": "",
            },
            instance=user,
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved = form.save()
        self.assertEqual(saved.first_name, "Ada")
        self.assertEqual(saved.last_name, "Lovelace")
