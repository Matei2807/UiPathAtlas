from django.apps import AppConfig


class EcommerceCoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ecommerce_core'

    def ready(self):
        import ecommerce_core.signals
