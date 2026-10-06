-- Seed 5 questions per concept
-- Concepts: Arrays, Linked Lists, Stacks, Queues (Wait, 6 concepts total in 2 units: Arrays and Linked Lists; Stacks and Queues)
-- Let's create the concepts first.
INSERT INTO concepts (id, title, unit, order_index, description) VALUES
('arrays_1', 'Introduction to Arrays', 'Arrays and Linked Lists', 1, 'Basic array concept and memory layout.'),
('arrays_2', 'Array Operations', 'Arrays and Linked Lists', 2, 'Insertion, deletion, and access in arrays.'),
('linked_lists_1', 'Singly Linked Lists', 'Arrays and Linked Lists', 3, 'Nodes and pointers.'),
('linked_lists_2', 'Doubly Linked Lists', 'Arrays and Linked Lists', 4, 'Previous and next pointers.'),
('stacks_1', 'Stacks', 'Stacks and Queues', 5, 'LIFO principle and push/pop operations.'),
('queues_1', 'Queues', 'Stacks and Queues', 6, 'FIFO principle and enqueue/dequeue operations.');

INSERT INTO concept_prereqs (concept_id, prereq_id) VALUES
('arrays_2', 'arrays_1'),
('linked_lists_1', 'arrays_2'),
('linked_lists_2', 'linked_lists_1'),
('stacks_1', 'linked_lists_2'),
('queues_1', 'stacks_1');

-- Seed 5 questions per concept (30 questions total). Just a subset here for brevity, but I must seed 5 per concept as requested.
-- I'll seed exactly 5 for arrays_1 for now to represent the structure, and fill the rest in a script or directly.

-- Actually, I'll generate exactly 5 per concept.
-- arrays_1
INSERT INTO question_bank (concept_id, type, stem, options, answer, rubric, hint1, hint2, hint3, difficulty) VALUES
('arrays_1', 'mcq', 'What is an array?', '["A collection of elements of the same type", "A dynamic data structure", "A LIFO structure", "A node-based structure"]', 'A collection of elements of the same type', NULL, 'Think about how elements are stored in memory.', 'They share the same data type.', 'The correct answer mentions elements of the same type.', 'easy'),
('arrays_1', 'numeric', 'If an array starts at memory address 1000 and each element is 4 bytes, what is the address of index 2?', NULL, '1008', NULL, 'Use the formula: base_address + index * size.', '1000 + 2 * 4', '1000 + 8 = 1008.', 'medium'),
('arrays_1', 'short', 'Explain how elements are accessed in an array.', NULL, 'Direct access via index', 'Must mention direct access or index-based access.', 'How do you get the 5th element?', 'You use its position.', 'You use the array index for direct access.', 'hard'),
('arrays_1', 'mcq', 'Arrays have a fixed size in memory. (True/False)', '["True", "False"]', 'True', NULL, 'Can you resize a static array easily?', 'Static arrays are allocated once.', 'They have a fixed size.', 'easy'),
('arrays_1', 'mcq', 'Which of the following is true about array memory allocation?', '["It is contiguous", "It is scattered", "It is dynamic", "It uses pointers"]', 'It is contiguous', NULL, 'How are elements placed next to each other?', 'They are in a continuous block.', 'The memory is contiguous.', 'medium');

-- arrays_2
INSERT INTO question_bank (concept_id, type, stem, options, answer, rubric, hint1, hint2, hint3, difficulty) VALUES
('arrays_2', 'mcq', 'What is the time complexity of accessing an element in an array by index?', '["O(1)", "O(n)", "O(log n)", "O(n^2)"]', 'O(1)', NULL, 'Does the time depend on the size of the array?', 'It takes the same time no matter the index.', 'It is constant time.', 'easy'),
('arrays_2', 'short', 'Why is inserting at the beginning of an array slow?', NULL, 'Because all other elements must be shifted', 'Must mention shifting of elements.', 'What happens to the existing elements?', 'They need to make room.', 'They must be shifted right.', 'medium'),
('arrays_2', 'numeric', 'If you have an array of size 10 and you insert at index 0, how many elements must be shifted?', NULL, '10', NULL, 'Every element from index 0 to 9 moves.', 'Count them.', 'All 10 elements must shift.', 'hard'),
('arrays_2', 'mcq', 'Deleting the last element of an array is O(1).', '["True", "False"]', 'True', NULL, 'Do you need to shift elements?', 'No elements are after it.', 'True, it is O(1).', 'easy'),
('arrays_2', 'mcq', 'Which operation requires shifting elements?', '["Accessing", "Updating", "Inserting at the beginning", "Reading"]', 'Inserting at the beginning', NULL, 'Which one changes the position of other elements?', 'Adding at the start pushes others.', 'Inserting at the beginning.', 'medium');

-- linked_lists_1
INSERT INTO question_bank (concept_id, type, stem, options, answer, rubric, hint1, hint2, hint3, difficulty) VALUES
('linked_lists_1', 'mcq', 'What does a linked list node contain?', '["Data and a pointer", "Only data", "Two pointers", "An array"]', 'Data and a pointer', NULL, 'It needs the value and a way to find the next item.', 'It has two parts.', 'Data and a next pointer.', 'easy'),
('linked_lists_1', 'short', 'What is the main advantage of a linked list over an array?', NULL, 'Dynamic size and fast insertions/deletions at the ends', 'Must mention dynamic size or O(1) insertions at known positions.', 'Think about memory allocation.', 'You do not need contiguous memory.', 'Dynamic size.', 'medium'),
('linked_lists_1', 'numeric', 'How many pointers does a node in a singly linked list have?', NULL, '1', NULL, 'It only points forward.', 'Just one.', '1', 'easy'),
('linked_lists_1', 'mcq', 'The last node in a singly linked list points to:', '["Null", "The first node", "Itself", "A random memory address"]', 'Null', NULL, 'What indicates the end?', 'It points to nothing.', 'Null.', 'easy'),
('linked_lists_1', 'mcq', 'Accessing the nth element in a linked list takes:', '["O(1)", "O(n)", "O(log n)", "O(n^2)"]', 'O(n)', NULL, 'Can you jump directly to it?', 'You must traverse from the head.', 'O(n).', 'hard');

-- linked_lists_2
INSERT INTO question_bank (concept_id, type, stem, options, answer, rubric, hint1, hint2, hint3, difficulty) VALUES
('linked_lists_2', 'mcq', 'A doubly linked list node contains:', '["Data and one pointer", "Data and two pointers", "Only pointers", "Two data fields"]', 'Data and two pointers', NULL, 'It points forward and backward.', 'Next and previous.', 'Data and two pointers.', 'easy'),
('linked_lists_2', 'short', 'What is a benefit of a doubly linked list?', NULL, 'Can traverse in both directions', 'Must mention bidirectional traversal.', 'Can you go backwards?', 'Yes, using the prev pointer.', 'Traverse in both directions.', 'medium'),
('linked_lists_2', 'numeric', 'How many pointers are updated when deleting a middle node in a doubly linked list?', NULL, '2', NULL, 'The previous node and the next node need updates.', 'Prev next, and Next prev.', '2 pointers are updated.', 'hard'),
('linked_lists_2', 'mcq', 'A doubly linked list requires more memory per node than a singly linked list.', '["True", "False"]', 'True', NULL, 'It has an extra pointer.', 'Pointers take memory.', 'True.', 'easy'),
('linked_lists_2', 'mcq', 'Which pointer does the first node''s "prev" point to in a standard doubly linked list?', '["Null", "The last node", "The second node", "Itself"]', 'Null', NULL, 'There is nothing before the head.', 'It points to nothing.', 'Null.', 'medium');

-- stacks_1
INSERT INTO question_bank (concept_id, type, stem, options, answer, rubric, hint1, hint2, hint3, difficulty) VALUES
('stacks_1', 'mcq', 'Stacks operate on which principle?', '["FIFO", "LIFO", "Random Access", "LILO"]', 'LIFO', NULL, 'Last in, first out.', 'Like a stack of plates.', 'LIFO.', 'easy'),
('stacks_1', 'short', 'What does the push operation do?', NULL, 'Adds an element to the top of the stack', 'Must mention adding to the top.', 'Where do new plates go?', 'On top.', 'Adds to the top.', 'medium'),
('stacks_1', 'numeric', 'If you push 1, 2, 3 onto a stack and then pop once, what value is returned?', NULL, '3', NULL, 'Which was pushed last?', '3 was last.', '3 is returned.', 'easy'),
('stacks_1', 'mcq', 'What is a common use case for stacks?', '["Undo mechanisms", "Print queues", "Breadth-first search", "Scheduling"]', 'Undo mechanisms', NULL, 'Think about reversing actions.', 'Ctrl+Z uses this.', 'Undo mechanisms.', 'medium'),
('stacks_1', 'mcq', 'The pop operation on an empty stack causes:', '["Underflow", "Overflow", "Success", "Nothing"]', 'Underflow', NULL, 'You are trying to take from nothing.', 'It is an error.', 'Stack underflow.', 'hard');

-- queues_1
INSERT INTO question_bank (concept_id, type, stem, options, answer, rubric, hint1, hint2, hint3, difficulty) VALUES
('queues_1', 'mcq', 'Queues operate on which principle?', '["FIFO", "LIFO", "Random Access", "FILO"]', 'FIFO', NULL, 'First in, first out.', 'Like a line at a store.', 'FIFO.', 'easy'),
('queues_1', 'short', 'What does the enqueue operation do?', NULL, 'Adds an element to the back of the queue', 'Must mention adding to the back/rear.', 'Where do you join a line?', 'At the end.', 'Adds to the back.', 'medium'),
('queues_1', 'numeric', 'If you enqueue 1, 2, 3 and dequeue once, what value is returned?', NULL, '1', NULL, 'Which was added first?', '1 was first.', '1 is returned.', 'easy'),
('queues_1', 'mcq', 'Which pointer tracks the next element to be removed?', '["Front/Head", "Back/Tail", "Top", "Bottom"]', 'Front/Head', NULL, 'People leave from the front of the line.', 'The head of the queue.', 'Front/Head.', 'medium'),
('queues_1', 'mcq', 'Breadth-first search uses which data structure?', '["Stack", "Queue", "Array", "Tree"]', 'Queue', NULL, 'It explores level by level.', 'First discovered, first explored.', 'Queue.', 'hard');
