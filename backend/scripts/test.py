from google.cloud import secretmanager
from google.oauth2 import service_account

SERVICE_ACCOUNT_FILE = "C:/Users/admin/Desktop/GOAnywhere/backend/storage/service-account-key.json"
SECRET_NAME = "projects/goanywhere-c55c8/secrets/firebase-service-account-key/versions/latest"

# Load credentials explicitly
credentials = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE)
print(f"🔍 Using credentials for: {credentials.service_account_email}")

# Instantiate the client with these credentials
client = secretmanager.SecretManagerServiceClient(credentials=credentials)

# Access the secret
response = client.access_secret_version(request={"name": SECRET_NAME})
secret_data = response.payload.data.decode("utf-8")

print("✅ Successfully retrieved secret:")
print(secret_data)
