from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm

from accounts.models import User


class EmailNormalizationMixin:
    def clean_email(self):
        return self.cleaned_data["email"].strip().lower()


class AccountCreationForm(EmailNormalizationMixin, AdminUserCreationForm):
    class Meta(AdminUserCreationForm.Meta):
        model = User
        fields = ("email",)
        field_classes = {}


class AccountChangeForm(EmailNormalizationMixin, UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        field_classes = {}
