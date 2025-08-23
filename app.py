from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore, storage
import os
import uuid
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize Firebase Admin SDK
try:
    # Use service account key file (you need to download this from Firebase Console)
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'your-project-id.appspot.com'  # Replace with your bucket name
    })
    
    # Initialize Firestore and Storage
    db = firestore.client()
    bucket = storage.bucket()
    
    print("Firebase initialized successfully")
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    # Fallback to local storage only
    db = None
    bucket = None

# Helper function to get file extension
def get_file_extension(filename):
    return os.path.splitext(filename)[1].lower()

# Helper function to format file size
def format_file_size(size):
    if size == 0:
        return "0 Bytes"
    units = ["Bytes", "KB", "MB", "GB"]
    i = 0
    while size >= 1024 and i < len(units) - 1:
        size /= 1024.0
        i += 1
    return f"{size:.2f} {units[i]}"

# Routes
@app.route('/')
def home():
    return jsonify({"message": "EduShare API is running"})

# User authentication endpoints
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    # In a real application, you would verify credentials against Firebase Auth
    # For this example, we'll just return a success response
    return jsonify({
        "success": True,
        "user": {
            "uid": str(uuid.uuid4()),
            "email": email,
            "displayName": email.split('@')[0]
        }
    })

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    display_name = data.get('displayName', email.split('@')[0])
    
    # In a real application, you would create a user in Firebase Auth
    # For this example, we'll just return a success response
    return jsonify({
        "success": True,
        "user": {
            "uid": str(uuid.uuid4()),
            "email": email,
            "displayName": display_name
        }
    })

# File upload endpoint
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    user_id = request.form.get('userId')
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if file:
        # Generate a unique filename
        file_id = str(uuid.uuid4())
        file_extension = get_file_extension(file.filename)
        filename = f"{file_id}{file_extension}"
        secure_name = secure_filename(filename)
        
        # Save file locally
        local_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_name)
        file.save(local_path)
        
        # Get file size
        file_size = os.path.getsize(local_path)
        formatted_size = format_file_size(file_size)
        
        # Determine file type
        file_type = "other"
        if file_extension in ['.pdf']:
            file_type = "pdf"
        elif file_extension in ['.doc', '.docx']:
            file_type = "doc"
        elif file_extension in ['.ppt', '.pptx']:
            file_type = "ppt"
        elif file_extension in ['.xls', '.xlsx']:
            file_type = "xls"
        elif file_extension in ['.txt']:
            file_type = "txt"
        elif file_extension in ['.zip', '.rar', '.7z']:
            file_type = "zip"
        elif file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
            file_type = "image"
        
        # Upload to Firebase Storage if available
        file_url = None
        if bucket:
            try:
                blob = bucket.blob(f"files/{secure_name}")
                blob.upload_from_filename(local_path)
                
                # Generate a download URL that expires in 10 years
                expiration = datetime.now() + timedelta(days=365 * 10)
                file_url = blob.generate_signed_url(expiration=expiration)
            except Exception as e:
                print(f"Error uploading to Firebase Storage: {e}")
        
        # Store file metadata in Firestore
        file_data = {
            "id": file_id,
            "name": file.filename,
            "type": file_type,
            "size": file_size,
            "formattedSize": formatted_size,
            "uploadDate": datetime.now().isoformat(),
            "ownerId": user_id,
            "downloadUrl": file_url or f"/api/download/{file_id}",
            "localPath": local_path if not bucket else None
        }
        
        if db:
            try:
                db.collection('files').document(file_id).set(file_data)
            except Exception as e:
                print(f"Error saving to Firestore: {e}")
        
        return jsonify({
            "success": True,
            "file": file_data
        })
    
    return jsonify({"error": "File upload failed"}), 500

# File download endpoint
@app.route('/api/download/<file_id>', methods=['GET'])
def download_file(file_id):
    if db:
        try:
            # Get file metadata from Firestore
            file_doc = db.collection('files').document(file_id).get()
            if not file_doc.exists:
                return jsonify({"error": "File not found"}), 404
            
            file_data = file_doc.to_dict()
            
            # If file is in Firebase Storage, redirect to the download URL
            if file_data.get('downloadUrl') and 'firebasestorage' in file_data['downloadUrl']:
                return jsonify({"url": file_data['downloadUrl']})
            
            # If file is stored locally, serve it
            if file_data.get('localPath') and os.path.exists(file_data['localPath']):
                return send_file(file_data['localPath'], as_attachment=True, download_name=file_data['name'])
        except Exception as e:
            print(f"Error retrieving file: {e}")
    
    # Fallback: check local storage
    local_files = os.listdir(app.config['UPLOAD_FOLDER'])
    for filename in local_files:
        if file_id in filename:
            local_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            return send_file(local_path, as_attachment=True)
    
    return jsonify({"error": "File not found"}), 404

# Get all files endpoint
@app.route('/api/files', methods=['GET'])
def get_files():
    files = []
    
    # Try to get files from Firestore first
    if db:
        try:
            docs = db.collection('files').stream()
            for doc in docs:
                file_data = doc.to_dict()
                files.append(file_data)
        except Exception as e:
            print(f"Error retrieving files from Firestore: {e}")
    
    # If no files in Firestore, check local storage
    if not files:
        local_files = os.listdir(app.config['UPLOAD_FOLDER'])
        for filename in local_files:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file_size = os.path.getsize(file_path)
            
            # Extract file ID from filename (UUID part before extension)
            file_id = os.path.splitext(filename)[0]
            
            files.append({
                "id": file_id,
                "name": filename,
                "type": "other",
                "size": file_size,
                "formattedSize": format_file_size(file_size),
                "uploadDate": datetime.fromtimestamp(os.path.getctime(file_path)).isoformat(),
                "ownerId": "unknown",
                "downloadUrl": f"/api/download/{file_id}",
                "localPath": file_path
            })
    
    return jsonify({"files": files})

# Add review to a file
@app.route('/api/files/<file_id>/reviews', methods=['POST'])
def add_review(file_id):
    data = request.get_json()
    user_id = data.get('userId')
    rating = data.get('rating')
    comment = data.get('comment')
    
    if not all([user_id, rating, comment]):
        return jsonify({"error": "Missing required fields"}), 400
    
    review_data = {
        "id": str(uuid.uuid4()),
        "fileId": file_id,
        "userId": user_id,
        "rating": rating,
        "comment": comment,
        "date": datetime.now().isoformat()
    }
    
    # Store review in Firestore if available
    if db:
        try:
            db.collection('reviews').document(review_data['id']).set(review_data)
        except Exception as e:
            print(f"Error saving review to Firestore: {e}")
            return jsonify({"error": "Failed to save review"}), 500
    
    return jsonify({
        "success": True,
        "review": review_data
    })

# Get reviews for a file
@app.route('/api/files/<file_id>/reviews', methods=['GET'])
def get_reviews(file_id):
    reviews = []
    
    if db:
        try:
            # Query reviews for this file
            docs = db.collection('reviews').where('fileId', '==', file_id).stream()
            for doc in docs:
                reviews.append(doc.to_dict())
        except Exception as e:
            print(f"Error retrieving reviews from Firestore: {e}")
    
    return jsonify({"reviews": reviews})

if __name__ == '__main__':
    app.run(debug=True, port=5000)