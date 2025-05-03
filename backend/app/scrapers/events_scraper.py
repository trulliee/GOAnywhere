# app/scrapers/events_scraper.py
import requests
from bs4 import BeautifulSoup
import time
from datetime import datetime
from app.database.firestore_utils import store_events_data

def scrape_visit_singapore_events(max_pages=5):
    """
    Scrapes events data from the Visit Singapore website.
    
    Args:
        max_pages (int): Maximum number of pages to scrape
        
    Returns:
        list: List of event dictionaries
    """
    base_url = "https://www.visitsingapore.com/whats-happening/all-happenings/"
    events = []
    
    # Loop through pages
    for page in range(1, max_pages + 1):
        try:
            # Construct URL with page parameter
            if page == 1:
                url = f"{base_url}?anchorid=Events"
            else:
                url = f"{base_url}?page={page}&anchorid=Events"
                
            print(f"Scraping page {page}: {url}")
            
            # Send HTTP request
            response = requests.get(url)
            response.raise_for_status()  # Raise exception for 4XX/5XX status
            
            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find event elements
            event_elements = soup.select('.card.card-event')
            
            if not event_elements:
                print(f"No events found on page {page}, stopping pagination")
                break
                
            # Process each event
            for event_elem in event_elements:
                try:
                    # Extract event data
                    title_elem = event_elem.select_one('.card-title')
                    date_elem = event_elem.select_one('.date-label-sm')
                    desc_elem = event_elem.select_one('.card-description')
                    img_elem = event_elem.select_one('img')
                    url_elem = event_elem.select_one('a.card-link')
                    
                    # Skip if missing essential elements
                    if not (title_elem and url_elem):
                        continue
                        
                    # Create event object
                    event = {
                        'title': title_elem.text.strip() if title_elem else '',
                        'date_text': date_elem.text.strip() if date_elem else '',
                        'description': desc_elem.text.strip() if desc_elem else '',
                        'image_url': img_elem['src'] if img_elem and 'src' in img_elem.attrs else '',
                        'event_url': 'https://www.visitsingapore.com' + url_elem['href'] if url_elem and 'href' in url_elem.attrs else '',
                        'source': 'Visit Singapore',
                        'scraped_at': datetime.now().isoformat()
                    }
                    
                    # Extract specific date information if possible
                    if event['date_text']:
                        event['parsed_dates'] = parse_event_dates(event['date_text'])
                    
                    events.append(event)
                    
                except Exception as e:
                    print(f"Error processing event: {e}")
            
            print(f"Scraped {len(event_elements)} events from page {page}")
            
            # Be nice to the server
            time.sleep(2)
            
        except Exception as e:
            print(f"Error scraping page {page}: {e}")
            break
    
    print(f"Total events scraped: {len(events)}")
    
    # Store the events in Firestore
    if events:
        store_events_data(events)
    
    return events

def parse_event_dates(date_text):
    """
    Attempts to parse date information from event date text.
    
    Args:
        date_text (str): Date text from the website
        
    Returns:
        dict: Dictionary with start_date and end_date if parsing is successful
    """
    try:
        # Handle different date formats
        date_info = {}
        
        # Example: "15 Apr - 30 May 2023"
        if ' - ' in date_text:
            parts = date_text.split(' - ')
            if len(parts) == 2:
                # Check if both parts have year
                if not parts[0].strip().split(' ')[-1].isdigit() and parts[1].strip().split(' ')[-1].isdigit():
                    # Add year to first part from second part
                    year = parts[1].strip().split(' ')[-1]
                    parts[0] = parts[0].strip() + ' ' + year
                
                try:
                    date_info['start_date'] = parse_date_string(parts[0].strip())
                    date_info['end_date'] = parse_date_string(parts[1].strip())
                except:
                    pass
        else:
            # Single date event
            try:
                date_info['event_date'] = parse_date_string(date_text.strip())
            except:
                pass
        
        return date_info
    except:
        return {}

def parse_date_string(date_str):
    """
    Parse a date string into ISO format.
    
    Args:
        date_str (str): Date string like "15 Apr 2023"
        
    Returns:
        str: ISO format date or original string if parsing fails
    """
    try:
        # Try several date formats
        formats = [
            "%d %b %Y",       # 15 Apr 2023
            "%d %B %Y",       # 15 April 2023
            "%d %b - %d %b %Y", # 15 Apr - 20 Apr 2023
            "%b %Y",          # Apr 2023
            "%B %Y"           # April 2023
        ]
        
        for fmt in formats:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                return parsed_date.isoformat().split('T')[0]  # Return YYYY-MM-DD
            except:
                continue
                
        return date_str  # Return original if all parsing attempts fail
    except:
        return date_str

def get_event_details(event_url):
    """
    Scrapes detailed information for a specific event.
    
    Args:
        event_url (str): URL to the event page
        
    Returns:
        dict: Detailed event information
    """
    try:
        # Send HTTP request
        response = requests.get(event_url)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract detailed information
        details = {}
        
        # Get event location
        location_elem = soup.select_one('.event-location')
        if location_elem:
            details['location'] = location_elem.text.strip()
        
        # Get ticket information
        ticket_elem = soup.select_one('.event-ticket-info')
        if ticket_elem:
            details['ticket_info'] = ticket_elem.text.strip()
        
        # Get full description
        desc_elem = soup.select_one('.event-description')
        if desc_elem:
            details['full_description'] = desc_elem.text.strip()
        
        # Get event categories/tags
        tag_elems = soup.select('.event-tag')
        if tag_elems:
            details['tags'] = [tag.text.strip() for tag in tag_elems]
        
        return details
    except Exception as e:
        print(f"Error getting event details: {e}")
        return {}

if __name__ == "__main__":
    # Run the scraper directly if this file is executed
    events = scrape_visit_singapore_events(max_pages=3)
    print(f"Scraped {len(events)} events")