// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "../libraries/calldata/bytes32/sorted-hash/merkle-library.sol";

contract Merkle_Storage_Using_Lib_Calldata_Bytes32_Sorted_Hash {
  bytes32 public root;

  event Some_Data(bytes32 some_data);

  function _debug_set_root(bytes32 _root) external {
    root = _root;
  }

  function verify_size(uint256 size, bytes32 element_root) external view returns (bool) {
    return Merkle_Library_CB32SH.verify_size(root, size, element_root);
  }

  function use_one(
    uint256 index,
    bytes32 element,
    bytes32[] calldata proof
  ) external {
    require(Merkle_Library_CB32SH.element_exists(root, index, element, proof), "INVALID_ELEMENT");

    emit Some_Data(
      Merkle_Library_CB32SH.hash_node(0x0000000000000000000000000000000000000000000000000000000000000001, element)
    );
  }

  function use_many(bytes32[] calldata elements, bytes32[] calldata proof) external {
    require(Merkle_Library_CB32SH.elements_exist(root, elements, proof), "INVALID_ELEMENTS");

    uint256 using_element_count = elements.length;
    bytes32 some_data = 0x0000000000000000000000000000000000000000000000000000000000000001;
    uint256 i;

    while (i < using_element_count) {
      some_data = Merkle_Library_CB32SH.hash_node(some_data, elements[i]);
      i += 1;
    }

    emit Some_Data(some_data);
  }

  function update_one(
    uint256 index,
    bytes32 element,
    bytes32 update_element,
    bytes32[] calldata proof
  ) external {
    root = Merkle_Library_CB32SH.try_update_one(root, index, element, update_element, proof);
  }

  function update_many(
    bytes32[] calldata elements,
    bytes32[] calldata updates_elements,
    bytes32[] calldata proof
  ) external {
    root = Merkle_Library_CB32SH.try_update_many(root, elements, updates_elements, proof);
  }

  function append_one(bytes32 append_element, bytes32[] calldata proof) external {
    root = Merkle_Library_CB32SH.try_append_one(root, append_element, proof);
  }

  function append_many(bytes32[] calldata append_elements, bytes32[] calldata proof) external {
    root = Merkle_Library_CB32SH.try_append_many(root, append_elements, proof);
  }

  function use_one_and_append_one(
    uint256 index,
    bytes32 element,
    bytes32 append_element,
    bytes32[] calldata proof
  ) external {
    root = Merkle_Library_CB32SH.try_append_one_using_one(root, index, element, append_element, proof);
  }

  function use_one_and_append_many(
    uint256 index,
    bytes32 element,
    bytes32[] calldata append_elements,
    bytes32[] calldata proof
  ) external {
    root = Merkle_Library_CB32SH.try_append_many_using_one(root, index, element, append_elements, proof);
  }

  function use_many_and_append_one(
    bytes32[] calldata elements,
    bytes32 append_element,
    bytes32[] calldata proof
  ) external {
    root = Merkle_Library_CB32SH.try_append_one_using_many(root, elements, append_element, proof);
  }

  function use_many_and_append_many(
    bytes32[] calldata elements,
    bytes32[] calldata append_elements,
    bytes32[] calldata proof
  ) external {
    root = Merkle_Library_CB32SH.try_append_many_using_many(root, elements, append_elements, proof);
  }

  function update_one_and_append_one(
    uint256 index,
    bytes32 element,
    bytes32 update_element,
    bytes32 append_element,
    bytes32[] calldata proof
  ) external {
    root = Merkle_Library_CB32SH.try_update_one_and_append_one(
      root,
      index,
      element,
      update_element,
      append_element,
      proof
    );
  }

  function update_one_and_append_many(
    uint256 index,
    bytes32 element,
    bytes32 update_element,
    bytes32[] calldata append_elements,
    bytes32[] calldata proof
  ) external {
    root = Merkle_Library_CB32SH.try_update_one_and_append_many(
      root,
      index,
      element,
      update_element,
      append_elements,
      proof
    );
  }

  function update_many_and_append_one(
    bytes32[] calldata elements,
    bytes32[] calldata update_elements,
    bytes32 append_element,
    bytes32[] calldata proof
  ) external {
    root = Merkle_Library_CB32SH.try_update_many_and_append_one(root, elements, update_elements, append_element, proof);
  }

  function update_many_and_append_many(
    bytes32[] calldata elements,
    bytes32[] calldata update_elements,
    bytes32[] calldata append_elements,
    bytes32[] calldata proof
  ) external {
    root = Merkle_Library_CB32SH.try_update_many_and_append_many(
      root,
      elements,
      update_elements,
      append_elements,
      proof
    );
  }
}
