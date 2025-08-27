import json
import os

class DataProcessor:
    """A class to process raw data files."""

    def __init__(self, source_directory: str):
        """Initializes the processor with a source directory."""
        if not os.path.isdir(source_directory):
            # Validate that the source directory exists on initialization.
            raise ValueError(f"Source directory not found: {source_directory}")
        self.source_directory = source_directory
        self.processed_data = []

    def _clean_record(self, record: dict) -> dict:
        """Private method to clean a single data record."""
        # Ensure 'name' key exists, then strip whitespace and capitalize.
        record["name"] = record.get("name", "Unknown").strip().title()
        # Add a status field to indicate processing is complete.
        record["status"] = "processed"
        return record

    def process_files(self, file_limit: int = 10):
        """
        Public method to find and process JSON files in the source directory.
        """
        # Use a list comprehension to find all .json files.
        json_files = [f for f in os.listdir(self.source_directory) if f.endswith(".json")]

        for i, filename in enumerate(json_files):
            # Stop if the file limit is reached.
            if i >= file_limit:
                print(f"Reached file limit of {file_limit}.")
                break

            file_path = os.path.join(self.source_directory, filename)
            # Use the helper function to load data.
            data = fetch_data_from_source(file_path)
            if data:
                # Iterate through each record in the loaded JSON data.
                for record in data:
                    cleaned_record = self._clean_record(record)
                    self.processed_data.append(cleaned_record)

        return self.processed_data

def fetch_data_from_source(path: str) -> list | None:
    """Standalone function to read data from a JSON file."""
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (IOError, json.JSONDecodeError) as e:
        # Handle potential errors during file reading or JSON parsing.
        print(f"Error reading {path}: {e}")
        return None

if __name__ == "__main__":
    # This block will only run when the script is executed directly.
    print("Initializing data processor...")
    # Note: This will fail if not run in the right context, which is fine for a test file.
    processor = DataProcessor("./data")
    results = processor.process_files()
    print(f"Processed {len(results)} records.")
