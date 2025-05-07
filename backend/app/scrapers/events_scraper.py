import requests
from bs4 import BeautifulSoup
import json
import time
from datetime import datetime
from app.database.firestore_utils import store_events_data

def scrape_visit_singapore_events():
    url = "https://www.visitsingapore.com/whats-happening/all-happenings/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    }

    print(f"Fetching Visit Singapore page: {url}")

    try:
        session = requests.Session()
        response = session.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Accept cookies if the button exists
        try:
            cookies_button = soup.select_one("button#onetrust-accept-btn-handler")
            if cookies_button:
                print("(Simulating) Accepting cookies...")
                # Cannot actually click using requests, but usually cookies auto-accepted in raw HTML
        except Exception as e:
            print(f"Cookie accept error (ignored): {e}")

        events_tag = soup.find("stb-event-and-festivals")
        if not events_tag or not events_tag.has_attr("aem-data"):
            print("Could not find events data on the page.")
            return []

        aem_data = json.loads(events_tag["aem-data"])
        events = []

        for card in aem_data.get("cardmultifield", []):
            event = {
                "title": card.get("cardTitle_t", ""),
                "description": BeautifulSoup(card.get("cardDescription_t", ""), "html.parser").text.strip(),
                "start_date": parse_event_date(card.get("eventStartDate")),
                "end_date": parse_event_date(card.get("eventEndDate")),
                "event_url": card.get("ctaUrl", ""),
                "image_url": card.get("cardImageDesktop", "") or card.get("cardImageMobile", ""),
                "source": "Visit Singapore",
                "scraped_at": datetime.now().isoformat()
            }
            events.append(event)

        print(f"Successfully scraped {len(events)} events.")

        if events:
            store_events_data(events)

        return events

    except requests.exceptions.RequestException as req_err:
        print(f"Request error: {req_err}")
        return []
    except Exception as e:
        print(f"Unexpected error: {e}")
        return []

def parse_event_date(date_str):
    try:
        if not date_str:
            return None
        return datetime.strptime(date_str, "%m-%d-%Y").date().isoformat()
    except Exception:
        return None

if __name__ == "__main__":
    print("Starting Visit Singapore events scraper...")
    events = scrape_visit_singapore_events()
    print(f"Scraped {len(events)} events.")