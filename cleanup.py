import re

file_path = "supabase/functions/tutor-turn/index.ts"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    # Fix the ternary operators and weird breaks
    line = re.sub(r'\[\.\!\?\w*\W*\]s\|', ' ? ', line)
    
    # Also fix some obvious broken lines
    if line.strip() == "let mastery = masteryRow  ?":
        lines[i] = "          let mastery = masteryRow ? masteryRow.p_mastery : 0.3;\n"
        lines[i+1] = ""
    if line.strip() == "let correctStreak = masteryRow  ?":
        lines[i] = "          let correctStreak = masteryRow ? masteryRow.correct_streak : 0;\n"
        lines[i+1] = ""
    if line.strip() == "let difficulty = masteryRow  ?":
        lines[i] = "          let difficulty = masteryRow ? masteryRow.difficulty : 'easy';\n"
        lines[i+1] = ""
    if line.strip() == "const questionPromise = session.current_question_id":
        lines[i] = "          const questionPromise = session.current_question_id ? supabaseClient.from('question_bank').select('*').eq('id', session.current_question_id).single() : Promise.resolve({ data: null });\n"
        lines[i+1] = ""
        lines[i+2] = ""
    if "const role = item.role === 'model'" in line:
        lines[i] = "    const role = item.role === 'model' ? 'model' : 'user';\n"
        lines[i+1] = ""
    if "const newStreak = verdict === 'correct'" in line:
        lines[i] = "            const newStreak = verdict === 'correct' ? correctStreak + 1 : 0;\n"
        lines[i+1] = ""
    if "expression: verdict === 'correct'" in line:
        lines[i] = "            expression: verdict === 'correct' ? 'happy' : 'thinking',\n"
        lines[i+1] = ""
    if "role: (h.role === 'student' || h.role === 'user')" in line:
        lines[i] = "              role: (h.role === 'student' || h.role === 'user') ? 'user' : 'model',\n"
        lines[i+1] = ""
    if "role: (m.role === 'student' || m.role === 'user')" in line:
        lines[i] = "              role: (m.role === 'student' || m.role === 'user') ? 'user' : 'model',\n"
        lines[i+1] = ""
    if "verdict = checkNumeric(message, question.answer)" in line:
        lines[i] = "              verdict = checkNumeric(message, question.answer) ? 'correct' : 'incorrect';\n"
        lines[i+1] = ""
    if "verdict = checkMcq(message, question.answer)" in line:
        lines[i] = "              verdict = checkMcq(message, question.answer) ? 'correct' : 'incorrect';\n"
        lines[i+1] = ""
    if "Deno.env.get('SUPABASE_URL')  ?" in line:
        lines[i] = "      Deno.env.get('SUPABASE_URL') ?? '',\n"
        lines[i+1] = ""
    if "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')  ?" in line:
        lines[i] = "      (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('MYGURU_SUPABASE_SERVICE_ROLE_KEY') ?? '')\n"
        lines[i+1] = ""
    if "Deno.env.get('MYGURU_SUPABASE_SERVICE_ROLE_KEY')  ?" in line:
        lines[i] = ""
        lines[i+1] = ""
    if line.strip() == "// Handle 5xx Transient Server Errors (e.g ?":
        lines[i] = "    // Handle 5xx Transient Server Errors (e.g. 503)\n"
        lines[i+1] = ""
    if line.strip() == "// 1 ?":
        lines[i] = "          // 1. Session & User Logic\n"
        lines[i+1] = ""
    if line.strip() == "// 2 ?":
        lines[i] = "          // 2. Determine RAG & Intent\n"
        lines[i+1] = ""
    if line.strip() == "// 3 ?":
        lines[i] = "          // 3. Answer Checking\n"
        lines[i+1] = ""
    if line.strip() == "// 4 ?":
        lines[i] = "          // 4. Pedagogy Logic\n"
        lines[i+1] = ""
    if line.strip() == "// 5 ?":
        lines[i] = "          // 5. System Instruction & Prompt\n"
        lines[i+1] = ""
    if line.strip() == "// 6 ?":
        lines[i] = "          // 6. DB Updates\n"
        lines[i+1] = ""
    if "4 ?" in line and "BREVITY & PEDAGOGY" in lines[i+1]:
        lines[i] = "4. BREVITY & PEDAGOGY:\n"
        lines[i+1] = ""
    
    # other random line joins
    lines[i] = lines[i].replace(" ? \n", " ")
    
    # fix "I'm sorry, I can't engage with that kind of request"
    if "I'm sorry, I can't engage with that kind of request" in line:
        lines[i] = "          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'sentence', index: 0, text: \"I'm sorry, I can't engage with that kind of request.\" })}\\n\\n`));\n"
        lines[i+1] = ""

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines([l for l in lines if l is not None and l != ""])

print("Cleanup complete")
