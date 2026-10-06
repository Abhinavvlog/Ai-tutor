---
concept_id: arrays_2
source_title: Array Operations
page: 2
---

# Array Operations

While arrays are fast for looking up data, they come with trade-offs when modifying the data. Understanding these trade-offs is key to writing efficient code.

### Access and Update

Accessing or updating an element at a specific index takes O(1) constant time. Since the memory is contiguous, the system simply takes the starting memory address and adds the size of the elements multiplied by the index to find the exact location instantly.

### Insertion

Inserting a new element into an array can be slow. If you want to insert a value at the very beginning of the array, you have to move every single existing element one position to the right to make space. In the worst case, this operation takes O(n) time, where n is the number of elements.

### Deletion

Deletion faces the same issue as insertion. If you remove the first element, a gap is left behind. To keep the array contiguous, all subsequent elements must be shifted one position to the left, which also takes O(n) time. However, deleting from the very end of an array is fast (O(1)) because no shifting is required.
