from app.infrastructure.mongodb.collections import get_users_collection


class UserMaintenanceRepository:
    """Persistence operations for one-time user-data compatibility cleanup."""

    @staticmethod
    def _users():
        return get_users_collection()

    async def normalize_legacy_roles(self) -> int:
        """Map the former vendedor/cajero values to the supported vendor role."""
        result = await self._users().update_many(
            {"role": {"$in": ["vendedor", "cajero"]}},
            {"$set": {"role": "vendor"}},
        )
        return result.modified_count

    async def disable_public_bootstrap_admin(self) -> bool:
        """Disable the exact administrator identity shipped by the old bootstrap."""
        users = self._users()
        legacy_admin = await users.find_one(
            {
                "username": "admin",
                "email": "admin@modasjayjo.com",
                "role": "admin",
            },
            {"_id": 1},
        )
        if legacy_admin is None:
            return False

        await users.update_one(
            {"_id": legacy_admin["_id"]},
            {"$set": {"role": "vendor", "is_active": False}},
        )
        return True
