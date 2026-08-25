import os

from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate


# --------------------------------
# 1. Load environment variables
# --------------------------------

load_dotenv()


# --------------------------------
# 2. Load document
# --------------------------------

loader = TextLoader("documents/employee_policy.txt")

documents = loader.load()

print("Original documents:", len(documents))


# --------------------------------
# 3. Split document into chunks
# --------------------------------

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=200,
    chunk_overlap=50
)

chunks = text_splitter.split_documents(documents)

print("Number of chunks:", len(chunks))


# --------------------------------
# 4. Create local embeddings
# --------------------------------

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)


# --------------------------------
# 5. Create ChromaDB
# --------------------------------

vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db",
    collection_name="employee_policy"
)

print("Documents stored in ChromaDB!")


# --------------------------------
# 6. Create Retriever
# --------------------------------

retriever = vectorstore.as_retriever(
    search_kwargs={"k": 2}
)


# --------------------------------
# 7. Create OpenRouter LLM
# --------------------------------

llm = ChatOpenAI(
    model="openrouter/free",
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)

parser = StrOutputParser()


# --------------------------------
# 8. Ask question
# --------------------------------

question = input("\nAsk a question: ")


# --------------------------------
# 9. Retrieve relevant chunks
# --------------------------------

results = vectorstore.similarity_search_with_score(
    question,
    k=2
)


# --------------------------------
# 10. Apply similarity threshold
# --------------------------------

threshold = 0.8

relevant_chunks = []

for result, score in results:

    print("\nScore:", score)

    if score <= threshold:

        print("PASS - Relevant chunk")

        relevant_chunks.append(result)

    else:

        print("REJECT - Irrelevant chunk")


# --------------------------------
# 11. Check if relevant context exists
# --------------------------------

if not relevant_chunks:

    print("\n==============================")
    print("FINAL ANSWER")
    print("==============================")

    print("I don't have enough information to answer that.")

else:

    # --------------------------------
    # 12. Create context
    # --------------------------------

    context = "\n\n".join(
        chunk.page_content
        for chunk in relevant_chunks
    )


    # --------------------------------
    # 13. Create prompt
    # --------------------------------

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """You are an employee policy assistant.

Answer the user's question using ONLY the provided context.

If the answer is not present in the context,
say: "I don't have enough information to answer that."

Do not make up information."""
        ),
        (
            "human",
            """Context:
{context}

Question:
{question}"""
        )
    ])


    # --------------------------------
    # 14. Create RAG chain
    # --------------------------------

    chain = prompt | llm | parser


    # --------------------------------
    # 15. Generate answer
    # --------------------------------

    answer = chain.invoke({
        "context": context,
        "question": question
    })


    # --------------------------------
    # 16. Final answer
    # --------------------------------

    print("\n==============================")
    print("FINAL ANSWER")
    print("==============================")

    print(answer)