import os
import subprocess
from datetime import datetime

models = [
    {
        "name": "goanywhere-traffic-congestion",
        "path": "model_serving/traffic_congestion"
    },
    {
        "name": "goanywhere-travel-time",
        "path": "model_serving/travel_time"
    }
]

def run_command(command_list, cwd=None):
    print(f"🛠️ Running: {' '.join(command_list)}")
    subprocess.run(command_list, cwd=cwd, check=True)

def deploy_model(model, version_tag):
    image_uri = f"asia-southeast1-docker.pkg.dev/goanywhere-c55c8/model-serving-repo/{model['name']}"

    print(f"\n🚀 Deploying {model['name']} with version: {version_tag}")

    # Build Docker image with model version
    run_command([
        "docker", "build", "-t", image_uri,
        "--build-arg", f"MODEL_VERSION={version_tag}",
        "."
    ], cwd=model["path"])

    # Push image
    run_command(["docker", "push", image_uri])

    # Deploy to Cloud Run
    run_command([
        "gcloud", "run", "deploy", f"{model['name']}-model-server",
        "--image", image_uri,
        "--region", "asia-southeast1",
        "--platform", "managed",
        "--allow-unauthenticated"
    ])

def delete_old_revisions(service_name, keep_latest=1):
    print(f"🧹 Cleaning up old revisions for: {service_name}")
    result = subprocess.run(
        [
            "gcloud", "run", "revisions", "list",
            "--service", service_name,
            "--region", "asia-southeast1",
            "--format", "value(METADATA.name)"
        ],
        capture_output=True,
        text=True,
    )

    revisions = result.stdout.strip().splitlines()
    if len(revisions) <= keep_latest:
        print("✅ No old revisions to delete.")
        return

    revisions_to_delete = revisions[keep_latest:]
    for rev in revisions_to_delete:
        print(f"❌ Deleting old revision: {rev}")
        subprocess.run([
            "gcloud", "run", "revisions", "delete", rev,
            "--region", "asia-southeast1",
            "--quiet"
        ])

if __name__ == "__main__":
    today_version = datetime.now().strftime("v1_%Y-%m-%d")

    for model in models:
        deploy_model(model, today_version)
        delete_old_revisions(f"{model['name']}-model-server")
