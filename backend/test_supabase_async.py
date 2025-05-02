from supabase import create_client, Client
import os
from dotenv import load_dotenv


load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

# Create a synchronous Supabase client
supabase: Client = create_client(url, key)

# You can now use the 'supabase' object for synchronous operations
# For example, to fetch data synchronously:
# response = supabase.from_('your_table_name').select('*').execute()
# print(response.data)

print("Supabase client created successfully (synchronous).")