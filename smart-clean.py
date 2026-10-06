file_path = "supabase/functions/tutor-turn/index.ts"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    # Only replace on lines that are clearly ternary operators or logic, NOT the actual regex line!
    if "const role = item.role === 'model'" in line:
        lines[i] = "    const role = item.role === 'model' ? 'model' : 'user';\n"
        if len(lines) > i+1 and "model' : 'user';" in lines[i+1]:
            lines[i+1] = ""
    elif "session.current_question_id" in line and "supabaseClient.from" in line:
        lines[i] = "          const questionPromise = session.current_question_id ? supabaseClient.from('question_bank').select('*').eq('id', session.current_question_id).single() : Promise.resolve({ data: null });\n"
        if len(lines) > i+1 and "supabaseClient.from" in lines[i+1]:
            lines[i+1] = ""
    elif "let mastery = masteryRow" in line:
        lines[i] = "          let mastery = masteryRow ? masteryRow.p_mastery : 0.3;\n"
    elif "let correctStreak = masteryRow" in line:
        lines[i] = "          let correctStreak = masteryRow ? masteryRow.correct_streak : 0;\n"
    elif "let difficulty = masteryRow" in line:
        lines[i] = "          let difficulty = masteryRow ? masteryRow.difficulty : 'easy';\n"
    elif "const newStreak = verdict === 'correct'" in line:
        lines[i] = "            const newStreak = verdict === 'correct' ? correctStreak + 1 : 0;\n"
    elif "expression: verdict === 'correct'" in line:
        lines[i] = "            expression: verdict === 'correct' ? 'happy' : 'thinking',\n"
    elif "role: (h.role === 'student' || h.role === 'user')" in line:
        lines[i] = "              role: (h.role === 'student' || h.role === 'user') ? 'user' : 'model',\n"
    elif "role: (m.role === 'student' || m.role === 'user')" in line:
        lines[i] = "              role: (m.role === 'student' || m.role === 'user') ? 'user' : 'model',\n"
    elif "verdict = checkNumeric(message, question.answer)" in line:
        lines[i] = "              verdict = checkNumeric(message, question.answer) ? 'correct' : 'incorrect';\n"
    elif "verdict = checkMcq(message, question.answer)" in line:
        lines[i] = "              verdict = checkMcq(message, question.answer) ? 'correct' : 'incorrect';\n"
    elif "Deno.env.get('SUPABASE_URL')" in line and "]" in line:
        lines[i] = "      Deno.env.get('SUPABASE_URL') ?? '',\n"
    elif "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')" in line and "]" in line:
        lines[i] = "      (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('MYGURU_SUPABASE_SERVICE_ROLE_KEY') ?? '')\n"
    elif "MYGURU_SUPABASE_SERVICE_ROLE_KEY" in line and "]" in line:
        lines[i] = ""
    elif "// Handle 5xx Transient Server Errors" in line:
        lines[i] = "    // Handle 5xx Transient Server Errors (e.g. 503, 502)\n"
    elif "I'm sorry, I can't engage with that kind of request" in line:
        lines[i] = "          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'sentence', index: 0, text: \"I'm sorry, I can't engage with that kind of request. Let's get back to our lesson.\" })}\\n\\n`));\n"
        lines[i+1] = ""
    elif "// 1" in line and "]" in line:
        lines[i] = "          // 1. Session & User Logic\n"
    elif "// 2" in line and "]" in line:
        lines[i] = "          // 2. Determine RAG & Intent\n"
    elif "// 3" in line and "]" in line:
        lines[i] = "          // 3. Answer Checking\n"
    elif "// 4" in line and "]" in line:
        lines[i] = "          // 4. Pedagogy Logic\n"
    elif "// 5" in line and "]" in line:
        lines[i] = "          // 5. System Instruction & Prompt\n"
    elif "// 6" in line and "]" in line:
        lines[i] = "          // 6. DB Updates\n"
    elif "4" in line and "]" in line and "BREVITY" in lines[i+1]:
        lines[i] = "4. BREVITY & PEDAGOGY:\n"
    elif "fallbackMsg =" in line and "from your course material" in line:
        lines[i] = "            const fallbackMsg = \"I'm not fully sure about this from your course material. Please check your textbook or ask your teacher.\";\n"
        if "Please check your textbook" in lines[i+1]:
            lines[i+1] = ""

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
