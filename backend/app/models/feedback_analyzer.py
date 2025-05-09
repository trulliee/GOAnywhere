import logging
from datetime import datetime, timedelta
from typing import Optional
from firebase_admin import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FeedbackAnalyzer:
    def __init__(self):
        self.db = firestore.client()
        self.feedback_collection = self.db.collection('simple_feedback')

    def record_feedback(self, prediction_type: str, rating: int, user_id: str, feedback_text: Optional[str] = None):
        if not (1 <= rating <= 5):
            raise ValueError("Rating must be between 1 and 5")

        feedback_data = {
            'prediction_type': prediction_type,
            'rating': rating,
            'user_id': user_id,
            'feedback_text': feedback_text or "",
            'timestamp': firestore.SERVER_TIMESTAMP
        }

        doc_ref = self.feedback_collection.document()
        doc_ref.set(feedback_data)

        logger.info(f"Feedback recorded: {feedback_data}")
        return doc_ref.id

    def analyze_feedback(self, prediction_type: str, days: int = 30):
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = (self.feedback_collection
                 .where('prediction_type', '==', prediction_type)
                 .where('timestamp', '>=', start_date)
                 .where('timestamp', '<=', end_date))

        feedback_docs = query.stream()
        feedback_list = [doc.to_dict() for doc in feedback_docs]

        if not feedback_list:
            return {
                'prediction_type': prediction_type,
                'feedback_count': 0,
                'average_rating': None,
                'message': 'No feedback available in the selected period'
            }

        total_rating = sum(f.get('rating', 0) for f in feedback_list)
        avg_rating = total_rating / len(feedback_list)
        high_ratings = sum(1 for f in feedback_list if f.get('rating', 0) >= 4)

        return {
            'prediction_type': prediction_type,
            'feedback_count': len(feedback_list),
            'average_rating': round(avg_rating, 2),
            'satisfaction_rate': round(high_ratings / len(feedback_list) * 100, 1),
            'period': f"Last {days} days"
        }
