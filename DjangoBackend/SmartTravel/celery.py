# Acest fișier definește instanța aplicației Celery.
# =============================================================================

import os
from celery import Celery

# Setează modulul de setări Django pentru programul 'celery'.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SmartTravel.settings')

app = Celery('SmartTravel')

# Folosind un string aici, muncitorul nu trebuie să serializeze
# obiectul de configurare la procesele copil.
# Namespace='CELERY' înseamnă că toate setările de configurare Celery
# trebuie să aibă un prefix `CELERY_`.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Încarcă modulele de task-uri din toate aplicațiile Django înregistrate.
app.autodiscover_tasks()