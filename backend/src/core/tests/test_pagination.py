from django.contrib.auth import get_user_model
from django.test import TestCase
from ninja_extra.exceptions import NotFound

from accounts.tests.helpers import PASSWORD
from core.pagination import paginate_queryset

User = get_user_model()


class PaginationTests(TestCase):
    def setUp(self):
        User.objects.create_user(email="one@example.com", password=PASSWORD)
        User.objects.create_user(email="two@example.com", password=PASSWORD)
        User.objects.create_user(email="three@example.com", password=PASSWORD)
        self.users = User.objects.order_by("email")

    def test_returns_the_requested_page(self):
        page = paginate_queryset(self.users, page=2, page_size=1)

        self.assertEqual(page["count"], 3)
        self.assertEqual(page["page"], 2)
        self.assertEqual(page["page_size"], 1)
        self.assertEqual(page["pages"], 3)
        self.assertEqual([user.email for user in page["results"]], ["three@example.com"])

    def test_uses_the_default_page_size(self):
        page = paginate_queryset(self.users, page=1)

        self.assertEqual(page["page_size"], 20)
        self.assertEqual(len(page["results"]), 3)
        self.assertEqual(page["pages"], 1)

    def test_caps_the_page_size(self):
        page = paginate_queryset(self.users, page=1, page_size=500)

        self.assertEqual(page["page_size"], 100)

    def test_empty_queryset_has_no_pages(self):
        page = paginate_queryset(User.objects.none(), page=1, page_size=10)

        self.assertEqual(page["count"], 0)
        self.assertEqual(page["pages"], 0)
        self.assertEqual(page["results"], [])

    def test_page_past_the_end_is_not_found(self):
        with self.assertRaises(NotFound):
            paginate_queryset(self.users, page=9, page_size=1)

    def test_page_zero_is_not_found(self):
        with self.assertRaises(NotFound):
            paginate_queryset(self.users, page=0, page_size=1)
