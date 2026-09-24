from django.db import migrations


class Migration(migrations.Migration):
    """
    Rename JobDescription's backing table from 'job_descriptions' -> 'jobs'
    to match the architecture diagram spec.

    NOTE: When running on Supabase PostgreSQL, this executes:
        ALTER TABLE job_descriptions RENAME TO jobs;
    The indexes declared on the model Meta are renamed automatically by Django.
    """

    dependencies = [
        ('models', '0004_company_remove_ranking_rankings_overall_b1f13e_idx_and_more'),
    ]

    operations = [
        migrations.AlterModelTable(
            name='jobdescription',
            table='jobs',
        ),
    ]
