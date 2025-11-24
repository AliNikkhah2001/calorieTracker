from __future__ import annotations

import reflex as rx

from weight_tracker.db import DATABASE_URL


class WeightTrackerConfig(rx.Config):
    pass


config = WeightTrackerConfig(
    app_name="weight_tracker",
    db_url=DATABASE_URL,
    env=rx.Env.DEV,
    disable_plugins=["reflex.plugins.sitemap.SitemapPlugin"],
    frontend_port=3005,
    backend_port=8765,
)
