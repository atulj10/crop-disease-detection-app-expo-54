import os

# Disable telemetry warnings
os.environ["ANONYMIZED_TELEMETRY"] = "False"

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings


PDF_FOLDER = "pdfs"

print("Loading embedding model...")

embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2"
)

documents = []

print("Scanning PDFs folder...")

for file in os.listdir(PDF_FOLDER):

    if file.endswith(".pdf"):

        path = os.path.join(PDF_FOLDER, file)

        print("Processing:", file)

        loader = PyPDFLoader(path)

        docs = loader.load()

        documents.extend(docs)


print("Splitting documents...")

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50
)

chunks = splitter.split_documents(documents)

print("Total chunks:", len(chunks))


print("Creating Chroma database...")

db = Chroma.from_documents(
    chunks,
    embeddings,
    persist_directory="chroma_db"
)

print("Vector database ready.")