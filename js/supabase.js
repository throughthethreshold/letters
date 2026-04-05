const SUPABASE_URL = 'https://lyoxsgcuavigbenldqlw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5b3hzZ2N1YXZpZ2JlbmxkcWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzODQ1MTIsImV4cCI6MjA5MDk2MDUxMn0.CFyrmjkXGO8XjZZ6BUAAoA-yj4WDjKfCqIXgQXgmZGk'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
