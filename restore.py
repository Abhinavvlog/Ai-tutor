with open(r'c:\Users\Shrijana\Downloads\MyGuru\tutor-turn-original.ts', 'r', encoding='utf-16le') as f:
    text = f.read()

with open(r'c:\Users\Shrijana\Downloads\MyGuru\supabase\functions\tutor-turn\index.ts', 'w', encoding='utf-8') as f:
    f.write(text)
