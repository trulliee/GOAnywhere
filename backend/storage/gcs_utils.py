
from google.cloud import storage
import os
from google.cloud import secretmanager
import json

# Initialize Google Cloud Storage client
storage_client = storage.Client()

def access_service_account_key(secret_name):
    """Accesses the service account key from Secret Manager."""
    client = secretmanager.SecretManagerServiceClient()
    
    # Using hardcoded project_id for temporary measure
    project_id = "goanywhere-c55c8"  # Replace with your actual Google Cloud Project ID
    secret_version = "latest"  # Specify the version, or "latest" for the latest version
    name = f"projects/541900038032/secrets/gcs-service-account-key/versions/latest"
    
    try:
        response = client.access_secret_version(name=name)
        secret_data = response.payload.data.decode("UTF-8")
        return secret_data  # Return the key content as a string, not a parsed JSON
    except Exception as e:
        print(f"Error accessing secret from Secret Manager: {e}")
        return None

def initialize_storage_client():
    """Initializes Google Cloud Storage client using the service account key from Secret Manager."""
    secret_name = "gcs-service-account-key"  # Replace with your secret name
    service_account_key = access_service_account_key(secret_name)
    
    if service_account_key:
        # Create a temporary file to store the service account key content
        with open("service-account-key.json", "w") as key_file:
            key_file.write(service_account_key)
        
        # Set up environment variable for the service account
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account-key.json"

        # Now you can use the storage client
        storage_client = storage.Client()
        return storage_client
    else:
        print("Failed to initialize storage client. Exiting.")
        return None

def upload_to_gcs(bucket_name, source_file_path, destination_blob_name):
    """Uploads a file to Google Cloud Storage (GCS)."""
    try:
        print(f"Uploading file from {source_file_path} to {destination_blob_name}")
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(source_file_path)
        print(f"File {source_file_path} uploaded to {destination_blob_name} in {bucket_name}.")
        return True
    except Exception as e:
        print(f"Error uploading to GCS: {e}")
        return False

def list_gcs_files(bucket_name):
    """Lists all files in a GCS bucket."""
    try:
        bucket = storage_client.bucket(bucket_name)
        blobs = bucket.list_blobs()
        return [blob.name for blob in blobs]
    except Exception as e:
        print(f"Error listing files: {e}")
        return []

if __name__ == "__main__":
    BUCKET_NAME = "goanywhere-traffic-data-history"
    
    # Example: Upload files (ensure the storage client is initialized properly)
    storage_client = initialize_storage_client()
    if storage_client:
        # Upload the first file
        file_uploaded_1 = upload_to_gcs(BUCKET_NAME, "C:/Users/admin/Downloads/RoadTrafficAccidentCasualtiesAnnual.csv", "uploads/RoadTrafficAccidentCasualtiesAnnual.csv")
        if file_uploaded_1:
            print("File 1 uploaded successfully!")

        # Upload the second file
        file_uploaded_2 = upload_to_gcs(BUCKET_NAME, "C:/Users/admin/Downloads/HistoricalDailyWeatherRecords.csv", "uploads/HistoricalDailyWeatherRecords.csv")
        if file_uploaded_2:
            print("File 2 uploaded successfully!")
    
        # List files
        files = list_gcs_files(BUCKET_NAME)
        print("Files in GCS:", files)
    else:
        print("Failed to upload files, storage client is not initialized.")
