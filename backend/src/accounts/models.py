from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("staff_role", "admin")
        extra_fields.setdefault("email_verified_at", timezone.now())
        if extra_fields.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=16, blank=True)
    email_verified_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    staff_role = models.CharField(max_length=16, blank=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"

    def __str__(self) -> str:
        return self.email

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None


class EmailVerification(models.Model):
    class Kind(models.TextChoices):
        VERIFY = "verify", "Verify email"
        LOGIN = "login", "Login code"
        RESET = "reset", "Reset password"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_verifications")
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.VERIFY)
    token_hash = models.CharField(max_length=64, unique=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(blank=True, null=True)
    revoked_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["user", "kind"]),
        ]


class DeviceSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="device_sessions")
    device_id = models.CharField(max_length=64)
    label = models.CharField(max_length=120, blank=True)
    user_agent = models.CharField(max_length=400, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    refresh_jti = models.CharField(max_length=64, blank=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["user", "revoked_at"]),
            models.Index(fields=["user", "device_id"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["user", "device_id"], name="unique_user_device"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.device_id}"
