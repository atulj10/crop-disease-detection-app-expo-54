from fastapi import FastAPI
from pydantic import BaseModel

from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings


app = FastAPI(
    title="Plant Disease Similarity Search API"
)

print("Loading embeddings...")

embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2"
)

print("Loading vector database...")

db = Chroma(
    persist_directory="chroma_db",
    embedding_function=embeddings
)


class SearchRequest(BaseModel):

    query: str
    top_k: int = 3


@app.get("/")
def health():

    return {
        "status": "running"
    }


@app.post("/search")
def search(request: SearchRequest):

    results = db.similarity_search(
        request.query,
        k=request.top_k
    )

    return {
        "results": [
            {
                "text": doc.page_content,
                "source": doc.metadata.get("source")
            }
            for doc in results
        ]
    }