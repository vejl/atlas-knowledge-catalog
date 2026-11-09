"""Start the local-only web server: python run.py."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("atlas.main:app", host="127.0.0.1", port=8000)
