# scripts/scrape_events.py
from app.scrapers.events_scraper import scrape_visit_singapore_events

def main():
    """Run the Visit Singapore events scraper."""
    print("Starting Visit Singapore events scraper...")
    events = scrape_visit_singapore_events(max_pages=5)
    print(f"Completed scraping. Found {len(events)} events.")

if __name__ == "__main__":
    main()