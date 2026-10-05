from django.core import mail

from accounts.models import DeviceSession
from accounts.tests.helpers import ApiTestCase, bearer, login, post_json, signup_and_verify


class DeviceSessionTests(ApiTestCase):
    def test_two_devices_can_stay_signed_in(self):
        signup_and_verify(self.client)
        phone = login(self.client, device_id="device-phone-01")
        laptop = login(self.client, device_id="device-laptop-01")
        self.assertEqual(phone.status_code, 200)
        self.assertEqual(laptop.status_code, 200)
        self.assertLessEqual(DeviceSession.objects.filter(revoked_at__isnull=True).count(), 2)

        first = post_json(self.client, "/api/v1/auth/refresh", {"refresh": phone.json()["data"]["tokens"]["refresh"]})
        second = post_json(self.client, "/api/v1/auth/refresh", {"refresh": laptop.json()["data"]["tokens"]["refresh"]})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)

    def test_a_third_device_revokes_the_oldest_named_session(self):
        signup_and_verify(self.client)
        first = login(self.client, device_id="device-one-aaa")
        second = login(self.client, device_id="device-two-bbb")
        third = login(self.client, device_id="device-three-ccc")
        self.assertEqual(third.status_code, 200)
        self.assertEqual(DeviceSession.objects.filter(revoked_at__isnull=True).count(), 2)

        stale = post_json(self.client, "/api/v1/auth/refresh", {"refresh": first.json()["data"]["tokens"]["refresh"]})
        self.assertEqual(stale.status_code, 401)
        alive = post_json(self.client, "/api/v1/auth/refresh", {"refresh": second.json()["data"]["tokens"]["refresh"]})
        self.assertEqual(alive.status_code, 200)

        blocked = self.client.get("/api/v1/profile", **bearer(first.json()["data"]["tokens"]["access"]))
        self.assertEqual(blocked.status_code, 401)

    def test_new_device_login_sends_mail(self):
        signup_and_verify(self.client)
        login(self.client, device_id="device-home-111")
        mail.outbox.clear()
        login(self.client, device_id="device-work-222")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("New device", mail.outbox[-1].subject)

    def test_same_device_reuses_its_session(self):
        signup_and_verify(self.client)
        login(self.client, device_id="device-same-zzz")
        mail.outbox.clear()
        again = login(self.client, device_id="device-same-zzz")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(DeviceSession.objects.filter(device_id="device-same-zzz", revoked_at__isnull=True).count(), 1)
        self.assertEqual(len(mail.outbox), 0)
        self.assertFalse(again.json()["data"]["device"]["is_new"])
