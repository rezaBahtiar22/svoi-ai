# 🟣 Svoy AI - AI Knowledge Base RAG

**Svoy AI** is a personal experimental project exploring **RAG (Retrieval-Augmented Generation)** technology. This project aims to build an API capable of processing personal documents and answering questions based on that data.

---

## 🚀 Tech Stack
- **Runtime:** [Bun](https://bun.sh/)
- **Backend Framework:** [ElysiaJS](https://elysiajs.com/) (TypeScript)
- **RAG Concepts:** Ingestion, Chunking, Embeddings, & Retrieval.
- **Documentation:** Swagger/Scalar (Automatic API Documentation)

## 🧠 Core RAG Concepts (The Process)
This project implements the four main stages of the RAG pipeline:
1. **Ingestion**: The process of receiving and reading various document formats (e.g., PDF, TXT) into the system.
2. **Chunking**: Breaking down long documents into smaller, manageable "chunks" of text. This helps the AI stay focused and stay within its "context limit."
3. **Embeddings**: Using an AI model to convert text chunks into numerical vectors (mathematical representations). This allows the computer to understand the "meaning" and "relationship" between words.
4. **Retrieval**: When a user asks a question, the system searches the Vector Database to find and "retrieve" the most relevant text chunks to provide an accurate answer.

## 📂 Project Structure
- `backend/`: Contains the main API logic and data processing.
- `docs/`: API contract documentation used as a development guide.
- `frontend/`: (Future plan) A simple interface to interact with the system.

## 🛠️ How to Run
1. Navigate to the backend folder: `cd backend`
2. Install dependencies: `bun install`
3. Run the server in development mode: `bun run dev`
4. Access the interactive API documentation at: `http://localhost:3000/v1/docs`