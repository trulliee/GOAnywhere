import logging
from datetime import datetime, timedelta
from typing import Optional
from firebase_admin import firestore

logger = logging.getLogger(__name__)

class FeedbackAnalyzer:
    def __init__(self):
        self.db = firestore.client()
        self.collection = self.db.collection('simple_feedback')

    def record_feedback(self, prediction_type: str, rating: int, user_id: str, feedback_text: Optional[str] = ""):
        if not (1 <= rating <= 5):
            raise ValueError("Rating must be between 1 and 5")

        data = {
            'prediction_type': prediction_type,
            'rating': rating,
            'user_id': user_id,
            'feedback_text': feedback_text,
            'timestamp': firestore.SERVER_TIMESTAMP
        }

        doc_ref = self.collection.document()
        doc_ref.set(data)
        logger.info(f"✅ Feedback recorded: {data}")
        return doc_ref.id

    def analyze_feedback(self, prediction_type: str, days: int = 30):
        end = datetime.now()
        start = end - timedelta(days=days)

        query = (self.collection
                 .where('prediction_type', '==', prediction_type)
                 .where('timestamp', '>=', start)
                 .where('timestamp', '<=', end))

        docs = query.stream()
        feedback = [doc.to_dict() for doc in docs]

        if not feedback:
            return {
                'prediction_type': prediction_type,
                'feedback_count': 0,
                'average_rating': None,
                'message': 'No feedback found'
            }

        total = sum(f['rating'] for f in feedback)
        high = sum(1 for f in feedback if f['rating'] >= 4)
        avg = total / len(feedback)

        return {
            'prediction_type': prediction_type,
            'feedback_count': len(feedback),
            'average_rating': round(avg, 2),
            'satisfaction_rate': round(high / len(feedback) * 100, 1),
            'period': f'Last {days} days'
        }
