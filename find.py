with open(r'C:\Users\Shrijana\.gemini\antigravity\brain\bd55da0e-f27a-4bda-8998-5cb3fadcf03d\.system_generated\tasks\task-5190.log', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('import "jsr:@supabase/functions-js/edge-runtime.d.ts"')
end = text.rfind('Deno.serve(')

if start != -1 and end != -1:
    print(text[end:end+1000])
else:
    print("Not found in 5190")

with open(r'C:\Users\Shrijana\.gemini\antigravity\brain\bd55da0e-f27a-4bda-8998-5cb3fadcf03d\.system_generated\tasks\task-5175.log', 'r', encoding='utf-8') as f:
    text2 = f.read()

start2 = text2.find('import "jsr:@supabase/functions-js/edge-runtime.d.ts"')
end2 = text2.rfind('Deno.serve(')

if start2 != -1 and end2 != -1:
    print(text2[end2:end2+1000])
else:
    print("Not found in 5175")
