import unittest
from unittest.mock import patch

import surveil


class FakeResponse:
    def __init__(self, data):
        self.data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self.data


class FakeSession:
    def __init__(self, data):
        self.data = data
        self.urls = []

    def get(self, url, **_kwargs):
        self.urls.append(url)
        return FakeResponse(self.data)


class AttendanceReadTests(unittest.TestCase):
    def test_status_never_calls_submit(self):
        session = FakeSession({"resultCode": "200", "body": {}})
        with patch.object(surveil, "_session_from_cookie", return_value=(session, "token")):
            result = surveil.read_course_attendance(123, "status", "ja-cookie")
        self.assertEqual(result["data"]["resultCode"], "200")
        self.assertEqual(len(session.urls), 1)
        self.assertIn("rollcall/existentB?courseCode=123", session.urls[0])
        self.assertNotIn("sign/scan", session.urls[0])

    def test_retries_expired_business_token_only_once(self):
        expired = FakeSession({"resultCode": "10001"})
        fresh = FakeSession({"resultCode": "200", "body": []})
        with patch.object(surveil, "_session_from_cookie", side_effect=[(expired, "old"), (fresh, "new")]) as login:
            result = surveil.read_course_attendance(123, "records", "ja-cookie", page_num=2, page_size=20)
        self.assertEqual(login.call_count, 2)
        self.assertIn("pageNum=2&pageSize=20", fresh.urls[0])
        self.assertEqual(result["data"]["resultCode"], "200")

    def test_rejects_invalid_parameters_before_network(self):
        with patch.object(surveil, "_session_from_cookie") as login:
            with self.assertRaises(ValueError):
                surveil.read_course_attendance(-1, "status", "ja-cookie")
            with self.assertRaises(ValueError):
                surveil.read_course_attendance(1, "records", "ja-cookie", page_size=1000)
        login.assert_not_called()


if __name__ == "__main__":
    unittest.main()
