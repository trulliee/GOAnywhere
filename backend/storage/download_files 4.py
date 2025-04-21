from google.cloud import storage

# Initialize Google Cloud Storage client
storage_client = storage.Client()

def download_from_gcs(bucket_name, files_to_download):
    """Downloads files from GCS to the local machine."""
    try:
        for file_name in files_to_download:
            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(file_name)
            blob.download_to_filename(file_name)
            print(f"Downloaded {file_name}")
    except Exception as e:
        print(f"Error downloading from GCS: {e}")

if __name__ == "__main__":
    BUCKET_NAME = "goanywhere-traffic-data-history"
    
    # Files to download
    files_to_download = [
        'uploads/HistoricalDailyWeatherRecords.csv',
        'uploads/RoadTrafficAccidentCasualtiesAnnual.csv'
    ]
    
    # Call the download function
    download_from_gcs(BUCKET_NAME, files_to_download)
