# backend/app/routes/cloud_jobs.py (FastAPI)
from fastapi import APIRouter
from app.services.lta_data import (
    get_estimated_travel_times, get_traffic_incidents, get_traffic_speed_bands, 
    get_vms_messages, get_faulty_traffic_lights, get_planned_road_openings, 
    get_approved_road_works, get_traffic_flow, get_bus_arrival, get_bus_services, get_bus_routes, get_train_service_alerts,
    get_station_crowd_density, get_station_crowd_forecast
)
from app.services.owm_data import fetch_weather_data
from app.scrapers.events_scraper import scrape_visit_singapore_events

router = APIRouter()

@router.post("/cloud_job/lta")
def trigger_lta_job():
    get_estimated_travel_times()
    get_traffic_incidents()
    get_traffic_speed_bands()
    get_vms_messages()
    get_faulty_traffic_lights() 
    get_planned_road_openings() 
    get_approved_road_works() 
    get_traffic_flow() 
    get_bus_arrival() 
    get_bus_services() 
    get_bus_routes() 
    get_train_service_alerts()
    get_station_crowd_density()
    get_station_crowd_forecast()
    return {"status": "success"}

@router.post("/cloud_job/weather")
def trigger_weather_job():
    return fetch_weather_data()

@router.post("/cloud_job/events")
def trigger_events_job():
    return {"status": scrape_visit_singapore_events()}

@router.post("/cloud_job/all")
def trigger_all_jobs():
    trigger_lta_job()
    trigger_weather_job()
    trigger_events_job()
    return {"status": "all jobs triggered"}