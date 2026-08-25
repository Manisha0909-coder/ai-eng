from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

# 1. Load document
loader = TextLoader("documents/employee_policy.txt")
documents = loader.load()

# 2. Split document
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=200,
    chunk_overlap=50
)

chunks = text_splitter.split_documents(documents)

print("Number of chunks:", len(chunks))

# 3. Create embedding model
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# 4. Store chunks + embeddings in ChromaDB
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db"
)

print("Documents stored in ChromaDB!")

query = "What is the company's stock price?"

results = vectorstore.similarity_search_with_score(
    query,
    k=2
)

threshold = 0.8

for result, score in results:

    if score <= threshold:
        print("\nPASS - Relevant chunk")
        print("Score:", score)
        print(result.page_content)

    else:
        print("\nREJECT - Irrelevant chunk")
        print("Score:", score)
