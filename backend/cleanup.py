#!/usr/bin/env python3
"""
Cleanup script for old practice schemas.

Run manually or via cron:
    python cleanup.py --max-age-hours 2

Or as a module:
    from cleanup import cleanup_old_schemas
    await cleanup_old_schemas(max_age_hours=2)
"""

import asyncio
import argparse
from datetime import datetime, timedelta

import asyncpg

from app.config import get_settings

settings = get_settings()


async def cleanup_old_schemas(max_age_hours: int = 2) -> list[str]:
    """
    Remove practice schemas older than max_age_hours.
    
    Args:
        max_age_hours: Maximum age in hours before cleanup
    
    Returns:
        List of dropped schema names
    """
    conn = await asyncpg.connect(dsn=settings.database_url)
    dropped: list[str] = []
    
    try:
        # Find all practice schemas
        schemas = await conn.fetch("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'practice_%'
        """)
        
        for record in schemas:
            schema_name = record["schema_name"]
            
            # Check schema age via any table's creation time
            # Note: This is approximate - PostgreSQL doesn't track schema creation time directly
            age_query = await conn.fetchrow(f"""
                SELECT MIN(
                    (SELECT create_date FROM pg_stat_file(
                        pg_relation_filepath(c.oid)
                    ))
                ) as oldest_table
                FROM pg_class c
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE n.nspname = $1 AND c.relkind = 'r'
            """, schema_name)
            
            # If we can't determine age or schema is old enough, drop it
            should_drop = False
            
            if age_query and age_query["oldest_table"]:
                age = datetime.now() - age_query["oldest_table"]
                should_drop = age > timedelta(hours=max_age_hours)
            else:
                # Can't determine age, check if schema has any tables
                table_count = await conn.fetchval(f"""
                    SELECT COUNT(*) 
                    FROM information_schema.tables 
                    WHERE table_schema = $1
                """, schema_name)
                # Empty schemas are safe to drop
                should_drop = table_count == 0
            
            if should_drop:
                await conn.execute(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE")
                dropped.append(schema_name)
                print(f"Dropped schema: {schema_name}")
    
    finally:
        await conn.close()
    
    return dropped


async def cleanup_with_metadata_table(max_age_hours: int = 2) -> list[str]:
    """
    Alternative cleanup using a metadata table for tracking.
    
    This is more reliable than filesystem-based age detection.
    Requires the aide_practice_meta table to exist.
    """
    conn = await asyncpg.connect(dsn=settings.database_url)
    dropped: list[str] = []
    
    try:
        # Create metadata table if it doesn't exist
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS public.aide_practice_meta (
                schema_name TEXT PRIMARY KEY,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Find and drop old schemas
        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        
        old_schemas = await conn.fetch("""
            SELECT schema_name 
            FROM public.aide_practice_meta 
            WHERE created_at < $1
        """, cutoff)
        
        for record in old_schemas:
            schema_name = record["schema_name"]
            await conn.execute(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE")
            await conn.execute("""
                DELETE FROM public.aide_practice_meta 
                WHERE schema_name = $1
            """, schema_name)
            dropped.append(schema_name)
            print(f"Dropped schema: {schema_name}")
        
        # Also clean up orphaned metadata (schemas that no longer exist)
        await conn.execute("""
            DELETE FROM public.aide_practice_meta m
            WHERE NOT EXISTS (
                SELECT 1 FROM information_schema.schemata s
                WHERE s.schema_name = m.schema_name
            )
        """)
    
    finally:
        await conn.close()
    
    return dropped


def main():
    parser = argparse.ArgumentParser(description="Clean up old practice schemas")
    parser.add_argument(
        "--max-age-hours",
        type=int,
        default=2,
        help="Maximum schema age in hours (default: 2)",
    )
    parser.add_argument(
        "--use-metadata",
        action="store_true",
        help="Use metadata table for tracking (more reliable)",
    )
    
    args = parser.parse_args()
    
    if args.use_metadata:
        dropped = asyncio.run(cleanup_with_metadata_table(args.max_age_hours))
    else:
        dropped = asyncio.run(cleanup_old_schemas(args.max_age_hours))
    
    print(f"Cleanup complete. Dropped {len(dropped)} schemas.")


if __name__ == "__main__":
    main()
