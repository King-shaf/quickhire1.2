from django.core.management.base import BaseCommand, CommandError
from django.db import models as dj_models
from models.models import User


class Command(BaseCommand):
    help = (
        "Unlock a user account (reset failed_attempts, account_locked=False, "
        "is_active=True). Use --all to unlock every user, or provide a list "
        "of usernames / emails / UUIDs."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'identifiers',
            nargs='*',
            help='Username, email, or user UUID to unlock',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            dest='all_users',
            help='Unlock every user in the database',
        )
        parser.add_argument(
            '--list-locked',
            action='store_true',
            dest='list_locked',
            help='Print all currently-locked users and exit',
        )

    def handle(self, *args, **options):
        if options['list_locked']:
            qs = User.objects.filter(
                dj_models.Q(account_locked=True)
                | dj_models.Q(failed_attempts__gte=5)
            ).order_by('username')
            if not qs.exists():
                self.stdout.write(self.style.SUCCESS('No locked users found.'))
                return
            self.stdout.write(
                f"{'Username':<22}{'Email':<32}{'Locked':>8}{'Attempts':>10}"
            )
            self.stdout.write('-' * 72)
            for u in qs:
                self.stdout.write(
                    f"{u.username:<22}{u.email:<32}"
                    f"{str(bool(getattr(u, 'account_locked', False))):>8}"
                    f"{str(getattr(u, 'failed_attempts', 0)):>10}"
                )
            return

        if options['all_users']:
            qs = User.objects.all()
        else:
            identifiers = options['identifiers']
            if not identifiers:
                raise CommandError(
                    'Provide at least one identifier (username / email / UUID), '
                    'or use --all. Run with --list-locked to see locked users.'
                )
            q = dj_models.Q()
            for ident in identifiers:
                q |= dj_models.Q(username__iexact=ident)
                q |= dj_models.Q(email__iexact=ident)
                try:
                    import uuid as _uuid
                    q |= dj_models.Q(pk=_uuid.UUID(ident))
                except (ValueError, AttributeError):
                    pass
            qs = User.objects.filter(q)

        if not qs.exists():
            self.stdout.write(
                self.style.WARNING('No users matched the given criteria.')
            )
            return

        updated = qs.update(
            failed_attempts=0,
            account_locked=False,
            is_active=True,
        )
        self.stdout.write(self.style.SUCCESS(f'Updated {updated} user(s):'))
        for u in qs.order_by('username'):
            self.stdout.write(
                f"  - {u.username}  <{u.email}>  (role={getattr(u, 'role', '?')})"
            )
