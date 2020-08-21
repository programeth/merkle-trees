'use strict';

// NOTE: indices must be in descending order

const assert = require('assert');
const { leftShift, and, or } = require('bitwise-buffer');

const { bitCount32 } = require('./utils');
const { generate } = require('./flag-multi-proofs');

// This is the MultiFlagProof.getRootBooleans algorithm, however, it additionally infers and
// verifies the decommitments needed for the append-proof, as the provided decommitments for the
// multi proof are verified. In order for the correct append-proof decommitments to be inferred,
// the multi-proof must be proving the existence of the last element. Two roots will be computed:
// one from the multi-proof and one from the inferred append-proof decommitments. They should
// match, so long as the multi-proof is valid, and the last element is being proved. The algorithm
// to inferring the append-proof decommitments is to take the left node of each hashing pair, if
// the right node of the hashing pair is both the "right-most" (last) node, and odd.
// See MultiFlagProof.getRootBooleans for relevant inline comments.
const getRootBooleans = ({ leafs, elementCount, flags, skips, decommitments, hashFunction }) => {
  const hashCount = flags.length;
  const leafCount = leafs.length;
  const hashes = Array(leafCount).fill(null);

  let readIndex = 0;
  let writeIndex = 0;
  let decommitmentIndex = 0;
  let useLeafs = true;

  // The index, localized to the level/depth, of where the first appended element will go
  let appendNodeIndex = elementCount;

  // Since hashes is a circular queue, we need to remember where the "right-most" hash is
  let readIndexOfAppendNode = 0;

  // We need as many append-proof decommitments as bits set in elementCount
  // and we will build this array in reverse order
  let appendDecommitmentIndex = bitCount32(elementCount);
  const appendDecommitments = Array(appendDecommitmentIndex).fill(null);

  // We will be accumulating the computed append-proof inferred root here
  let hash;

  for (let i = 0; i < hashCount; i++) {
    if (skips[i]) {
      // If we're skipping, we're definitely dealing with the last node on this level, and it is
      // an append-proof decommitment if this index is odd. Note two important things. First, for
      // all unbalanced trees, the first append-proof decommitment is from here, and it will be
      // the only append-proof decommitment taken from a "skipped" hash. Second, again for unbalanced
      // trees, appendNodeIndex is referencing the non-existent leaf to be added, when elementCount
      // is odd. When elementCount is even, it will be referencing an existing "right-most" node.
      const skippedHash = useLeafs ? leafs[readIndex++] : hashes[readIndex++];

      if (appendNodeIndex & 1) {
        appendDecommitments[--appendDecommitmentIndex] = skippedHash;

        // Since we know this will always be the first append decommitment, hash starts as it
        hash = skippedHash;
      }

      // Remember this circular queue index so we can tell when we've at the end of a new level
      readIndexOfAppendNode = writeIndex;

      // The index is localized to the level/depth, so the next one is it divided by 2
      appendNodeIndex >>>= 1;

      hashes[writeIndex++] = skippedHash;

      if (useLeafs && readIndex === leafCount) useLeafs = false;

      readIndex %= leafCount;
      writeIndex %= leafCount;
      continue;
    }

    const nextReadIndex = (readIndex + 1) % leafCount;

    // Note: we can save variables here by swapping flag/decommitment inclusion from "right"
    // to "left" below (taking care to check readIndex === leafCount after each), and using
    // left as the appendHash. Remember, hash order is not relevant for these trees.
    const appendHash = flags[i]
      ? useLeafs
        ? leafs[nextReadIndex]
        : hashes[nextReadIndex]
      : decommitments[decommitmentIndex];

    // Check if we're at the last ("right-most") node at a level (within the circular queue)
    if (readIndexOfAppendNode === readIndex) {
      // Only the hash sibling of odd "right-most" nodes are valid append-proof decommitments
      if (appendNodeIndex & 1) {
        // flag informs if the "left" node is a previously computed hash, or a decommitment
        appendDecommitments[--appendDecommitmentIndex] = appendHash;

        // Accumulate the append-proof decommitment
        hash = hashFunction(appendHash, hash);
      }

      // Remember this circular queue index so we can tell when we've at the end of a new level
      readIndexOfAppendNode = writeIndex;

      // The index is localized to the level/depth, so the next one is it divided by 2
      appendNodeIndex >>>= 1;
    }

    const right = flags[i] ? (useLeafs ? leafs[readIndex++] : hashes[readIndex++]) : decommitments[decommitmentIndex++];
    readIndex %= leafCount;
    const left = useLeafs ? leafs[readIndex++] : hashes[readIndex++];
    hashes[writeIndex++] = hashFunction(left, right);

    if (useLeafs && readIndex === leafCount) useLeafs = false;

    readIndex %= leafCount;
    writeIndex %= leafCount;
  }

  const root = useLeafs ? leafs[0] : hashes[(writeIndex === 0 ? leafCount : writeIndex) - 1];

  // For a balanced tree, there is only 1 append-proof decommitment: the root itself
  assert(appendDecommitmentIndex === 1 || hash.equals(root), 'Invalid Proof.');

  return { root: Buffer.from(root) };
};

// This is identical to the above getRootBooleans algorithm, differing only in that the
// the flag and skip bit-set is shifted and checked, rather than boolean arrays.
// See getRootBooleans for relevant inline comments.
const getRootBits = ({ leafs, elementCount, proof, hashFunction }) => {
  const flags = proof[0];
  const skips = proof[1];
  const decommitments = proof.slice(2);
  const leafCount = leafs.length;
  const hashes = Array(leafCount).fill(null);

  let readIndex = 0;
  let writeIndex = 0;
  let decommitmentIndex = 0;
  let useLeafs = true;
  let bitCheck = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex');

  let appendNodeIndex = elementCount;
  let readIndexOfAppendNode = 0;
  let appendDecommitmentIndex = bitCount32(elementCount);
  const appendDecommitments = Array(appendDecommitmentIndex).fill(null);
  let hash;

  while (true) {
    const flag = and(flags, bitCheck).equals(bitCheck);

    if (and(skips, bitCheck).equals(bitCheck)) {
      if (flag) {
        const root = useLeafs ? leafs[0] : hashes[(writeIndex === 0 ? leafCount : writeIndex) - 1];

        assert(appendDecommitmentIndex === 1 || hash.equals(root), 'Invalid Proof.');

        return { root: Buffer.from(root) };
      }

      const skippedHash = useLeafs ? leafs[readIndex++] : hashes[readIndex++];

      if (appendNodeIndex & 1) {
        appendDecommitments[--appendDecommitmentIndex] = skippedHash;
        hash = skippedHash;
      }

      readIndexOfAppendNode = writeIndex;
      appendNodeIndex >>>= 1;

      hashes[writeIndex++] = skippedHash;

      if (useLeafs && readIndex === leafCount) useLeafs = false;

      readIndex %= leafCount;
      writeIndex %= leafCount;
      bitCheck = leftShift(bitCheck, 1);
      continue;
    }

    const nextReadIndex = (readIndex + 1) % leafCount;

    const appendHash = flag
      ? useLeafs
        ? leafs[nextReadIndex]
        : hashes[nextReadIndex]
      : decommitments[decommitmentIndex];

    if (readIndexOfAppendNode === readIndex) {
      if (appendNodeIndex & 1) {
        appendDecommitments[--appendDecommitmentIndex] = appendHash;
        hash = hashFunction(appendHash, hash);
      }

      readIndexOfAppendNode = writeIndex;
      appendNodeIndex >>>= 1;
    }

    const right = flag ? (useLeafs ? leafs[readIndex++] : hashes[readIndex++]) : decommitments[decommitmentIndex++];
    readIndex %= leafCount;
    const left = useLeafs ? leafs[readIndex++] : hashes[readIndex++];
    hashes[writeIndex++] = hashFunction(left, right);

    if (useLeafs && readIndex === leafCount) useLeafs = false;

    readIndex %= leafCount;
    writeIndex %= leafCount;
    bitCheck = leftShift(bitCheck, 1);
  }
};

const getRoot = (parameters) => {
  return parameters.proof ? getRootBits(parameters) : getRootBooleans(parameters);
};

// This is identical to the above getRootBooleans followed by the AppendProof.getNewRootMulti.
// First, a loop computes the new root, given the decommitments and update elements. At the same
// time, the old root is computed, from the decommitments and original elements. Also, at the
// same time, the old root is computed, from the inferred append-proof decommitments. And also,
// at the same time, the new append-proof decommitments are computed from the updated elements.
// See getRootBooleans for relevant inline comments.
const getNewRootBooleans = ({
  leafs,
  updateLeafs,
  appendLeafs,
  elementCount,
  flags,
  skips,
  decommitments,
  hashFunction,
}) => {
  const hashCount = flags.length;
  const leafCount = leafs.length;
  const hashes = Array(leafCount).fill(null);

  // Will be used as a circular queue, then a stack, so needs to be large enough for either use.
  const newHashes = Array(Math.max(leafCount, (appendLeafs.length >>> 1) + 1)).fill(null);

  let readIndex = 0;
  let writeIndex = 0;
  let decommitmentIndex = 0;
  let useLeafs = true;
  let appendNodeIndex = elementCount;
  let readIndexOfAppendNode = 0;
  let appendDecommitmentIndex = bitCount32(elementCount);
  const appendDecommitments = Array(appendDecommitmentIndex).fill(null);
  let hash;

  for (let i = 0; i < hashCount; i++) {
    if (skips[i]) {
      const skippedHash = useLeafs ? leafs[readIndex] : hashes[readIndex];
      const newSkippedHash = useLeafs ? updateLeafs[readIndex++] : newHashes[readIndex++];

      if (appendNodeIndex & 1) {
        // decommitments for the append step are actually the new hashes, given the updated leafs.
        appendDecommitments[--appendDecommitmentIndex] = newSkippedHash;

        // hash still needs to accumulate old values, to result in old root.
        hash = skippedHash;
      }

      readIndexOfAppendNode = writeIndex;
      appendNodeIndex >>>= 1;

      hashes[writeIndex] = skippedHash;
      newHashes[writeIndex++] = newSkippedHash;

      if (useLeafs && readIndex === leafCount) useLeafs = false;

      readIndex %= leafCount;
      writeIndex %= leafCount;
      continue;
    }

    const nextReadIndex = (readIndex + 1) % leafCount;

    const appendHash = flags[i]
      ? useLeafs
        ? leafs[nextReadIndex]
        : hashes[nextReadIndex]
      : decommitments[decommitmentIndex];

    const newAppendHash = flags[i]
      ? useLeafs
        ? updateLeafs[nextReadIndex]
        : newHashes[nextReadIndex]
      : decommitments[decommitmentIndex];

    if (readIndexOfAppendNode === readIndex) {
      if (appendNodeIndex & 1) {
        // decommitments for the append step are actually the new hashes, given the updated leafs.
        appendDecommitments[--appendDecommitmentIndex] = newAppendHash;

        // hash still needs to accumulate old values, to result in old root.
        hash = hashFunction(appendHash, hash);
      }

      readIndexOfAppendNode = writeIndex;
      appendNodeIndex >>>= 1;
    }

    const right = flags[i] ? (useLeafs ? leafs[readIndex] : hashes[readIndex]) : decommitments[decommitmentIndex];

    const newRight = flags[i]
      ? useLeafs
        ? updateLeafs[readIndex++]
        : newHashes[readIndex++]
      : decommitments[decommitmentIndex++];

    readIndex %= leafCount;

    const left = useLeafs ? leafs[readIndex] : hashes[readIndex];
    const newLeft = useLeafs ? updateLeafs[readIndex++] : newHashes[readIndex++];

    hashes[writeIndex] = hashFunction(left, right);
    newHashes[writeIndex++] = hashFunction(newLeft, newRight);

    if (useLeafs && readIndex === leafCount) useLeafs = false;

    readIndex %= leafCount;
    writeIndex %= leafCount;
  }

  const rootIndex = (writeIndex === 0 ? leafCount : writeIndex) - 1;
  const oldRoot = useLeafs ? leafs[0] : hashes[rootIndex];
  const newRoot = useLeafs ? updateLeafs[0] : newHashes[rootIndex];

  assert(appendDecommitmentIndex === 1 || hash.equals(oldRoot), 'Invalid Proof.');

  // The new append decommitments is simply thew new root, for a balanced tree.
  if (appendDecommitmentIndex === 1) appendDecommitments[0] = newRoot;

  // The rest is a exactly the AppendProof.getNewRootMulti, with some reused
  // variables previously declared. Also, since the above steps validated the
  // decommitments and generated new valid ones, there is no need to compute
  // an accumulated root, as it is not being returned.
  appendDecommitmentIndex = bitCount32(elementCount) - 1;
  let upperBound = elementCount + appendLeafs.length - 1;
  writeIndex = 0;
  readIndex = 0;
  let offset = elementCount;
  let index = offset;

  while (upperBound > 0) {
    useLeafs = offset >= elementCount;

    if (writeIndex === 0 && index & 1) {
      newHashes[writeIndex++] = hashFunction(
        appendDecommitments[appendDecommitmentIndex--],
        useLeafs ? appendLeafs[readIndex++] : newHashes[readIndex++]
      );

      index++;
    } else if (index < upperBound) {
      newHashes[writeIndex++] = hashFunction(
        useLeafs ? appendLeafs[readIndex++] : newHashes[readIndex++],
        useLeafs ? appendLeafs[readIndex++] : newHashes[readIndex++]
      );
      index += 2;
    }

    if (index >= upperBound) {
      if (index === upperBound) newHashes[writeIndex] = useLeafs ? appendLeafs[readIndex] : newHashes[readIndex];

      readIndex = 0;
      writeIndex = 0;
      upperBound >>>= 1;
      offset >>>= 1;
      index = offset;
    }
  }

  return { root: Buffer.from(oldRoot), newRoot: newHashes[0] };
};

// This is identical to the above getNewRootBooleans algorithm, differing only in that the
// the flag and skip bit-set is shifted and checked, rather than boolean arrays.
// See getNewRootBooleans for relevant inline comments.
const getNewRootBits = ({ leafs, updateLeafs, appendLeafs, elementCount, proof, hashFunction }) => {
  const flags = proof[0];
  const skips = proof[1];
  const decommitments = proof.slice(2);
  const leafCount = leafs.length;
  const hashes = Array(leafCount).fill(null);
  const newHashes = Array(Math.max(leafCount, (appendLeafs.length >>> 1) + 1)).fill(null);

  let readIndex = 0;
  let writeIndex = 0;
  let decommitmentIndex = 0;
  let useLeafs = true;
  let bitCheck = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex');
  let appendNodeIndex = elementCount;
  let readIndexOfAppendNode = 0;
  let appendDecommitmentIndex = bitCount32(elementCount);
  const appendDecommitments = Array(appendDecommitmentIndex).fill(null);
  let hash;

  while (true) {
    const flag = and(flags, bitCheck).equals(bitCheck);

    if (and(skips, bitCheck).equals(bitCheck)) {
      if (flag) {
        const rootIndex = (writeIndex === 0 ? leafCount : writeIndex) - 1;
        const oldRoot = useLeafs ? leafs[0] : hashes[rootIndex];
        const newRoot = useLeafs ? updateLeafs[0] : newHashes[rootIndex];

        assert(appendDecommitmentIndex === 1 || hash.equals(oldRoot), 'Invalid Proof.');

        hash = oldRoot;

        if (appendDecommitmentIndex === 1) appendDecommitments[0] = newRoot;

        break;
      }

      const skippedHash = useLeafs ? leafs[readIndex] : hashes[readIndex];
      const newSkippedHash = useLeafs ? updateLeafs[readIndex++] : newHashes[readIndex++];

      if (appendNodeIndex & 1) {
        appendDecommitments[--appendDecommitmentIndex] = newSkippedHash;
        hash = skippedHash;
      }

      readIndexOfAppendNode = writeIndex;
      appendNodeIndex >>>= 1;

      hashes[writeIndex] = skippedHash;
      newHashes[writeIndex++] = newSkippedHash;

      if (useLeafs && readIndex === leafCount) useLeafs = false;

      readIndex %= leafCount;
      writeIndex %= leafCount;
      bitCheck = leftShift(bitCheck, 1);
      continue;
    }

    if (readIndexOfAppendNode === readIndex) {
      if (appendNodeIndex & 1) {
        const nextReadIndex = (readIndex + 1) % leafCount;

        const appendHash = flag
          ? useLeafs
            ? leafs[nextReadIndex]
            : hashes[nextReadIndex]
          : decommitments[decommitmentIndex];

        const newAppendHash = flag
          ? useLeafs
            ? updateLeafs[nextReadIndex]
            : newHashes[nextReadIndex]
          : decommitments[decommitmentIndex];

        appendDecommitments[--appendDecommitmentIndex] = newAppendHash;
        hash = hashFunction(appendHash, hash);
      }

      readIndexOfAppendNode = writeIndex;
      appendNodeIndex >>>= 1;
    }

    const right = flag ? (useLeafs ? leafs[readIndex] : hashes[readIndex]) : decommitments[decommitmentIndex];

    const newRight = flag
      ? useLeafs
        ? updateLeafs[readIndex++]
        : newHashes[readIndex++]
      : decommitments[decommitmentIndex++];

    readIndex %= leafCount;

    const left = useLeafs ? leafs[readIndex] : hashes[readIndex];
    const newLeft = useLeafs ? updateLeafs[readIndex++] : newHashes[readIndex++];

    hashes[writeIndex] = hashFunction(left, right);
    newHashes[writeIndex++] = hashFunction(newLeft, newRight);

    if (useLeafs && readIndex === leafCount) useLeafs = false;

    readIndex %= leafCount;
    writeIndex %= leafCount;
    bitCheck = leftShift(bitCheck, 1);
  }

  appendDecommitmentIndex = bitCount32(elementCount) - 1;
  let upperBound = elementCount + appendLeafs.length - 1;
  writeIndex = 0;
  readIndex = 0;
  let offset = elementCount;
  let index = offset;

  while (upperBound > 0) {
    useLeafs = offset >= elementCount;

    if (writeIndex === 0 && index & 1) {
      newHashes[writeIndex++] = hashFunction(
        appendDecommitments[appendDecommitmentIndex--],
        useLeafs ? appendLeafs[readIndex++] : newHashes[readIndex++]
      );

      index++;
    } else if (index < upperBound) {
      newHashes[writeIndex++] = hashFunction(
        useLeafs ? appendLeafs[readIndex++] : newHashes[readIndex++],
        useLeafs ? appendLeafs[readIndex++] : newHashes[readIndex++]
      );
      index += 2;
    }

    if (index >= upperBound) {
      if (index === upperBound) newHashes[writeIndex] = useLeafs ? appendLeafs[readIndex] : newHashes[readIndex];

      readIndex = 0;
      writeIndex = 0;
      upperBound >>= 1;
      offset >>>= 1;
      index = offset;
    }
  }

  return { root: Buffer.from(hash), newRoot: newHashes[0] };
};

const getNewRoot = (parameters) => {
  return parameters.proof ? getNewRootBits(parameters) : getNewRootBooleans(parameters);
};

// This returns the minimum index that must be in the proof, to result in a proof that will be
// a valid combined proof (i.e. a valid multi-proof and append-proof). Simply, set the first
// set bit in the element count to zero, and return that value.
const getMinimumIndex = (elementCount) => {
  for (let shifts = 0; shifts < 32; shifts++) {
    if (elementCount & 1) return (elementCount & 0xfffffffe) << shifts;

    elementCount >>>= 1;
  }
};

module.exports = { generate, getRoot, getNewRoot, getMinimumIndex };

// TODO: use separate set of flags for left/right hash order, allowing this to work for non-sorted-hash trees
//       Should be able to infer indices of elements based on proof hash order and flags
// TODO: consider another proof boolean-array informing when to take a hash as an append-decommitment
