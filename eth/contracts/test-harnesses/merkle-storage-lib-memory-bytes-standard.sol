// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "../libraries/memory/bytes/standard/merkle-library.sol";

contract Merkle_Storage_Using_Lib_Memory_Bytes_Standard {
  bytes32 public root;

  event Some_Data(bytes32 some_data);

  function _debug_set_root(bytes32 _root) public {
    root = _root;
  }

  function verify_indices(bytes[] memory elements, bytes32[] memory proof) public pure returns (uint256[] memory) {
    return Merkle_Library_MBS.get_indices(elements, proof);
  }

  function verify_size_with_proof(uint256 size, bytes32[] memory proof) public view returns (bool) {
    return Merkle_Library_MBS.verify_size_with_proof(root, size, proof);
  }

  function verify_size(uint256 size, bytes32 element_root) public view returns (bool) {
    return Merkle_Library_MBS.verify_size(root, size, element_root);
  }

  function use_one(
    uint256 index,
    bytes memory element,
    bytes32[] memory proof
  ) public {
    require(Merkle_Library_MBS.element_exists(root, index, element, proof), "INVALID_ELEMENT");

    emit Some_Data(keccak256(abi.encodePacked(bytes1(0x01), element)));
  }

  function use_many(bytes[] memory elements, bytes32[] memory proof) public {
    require(Merkle_Library_MBS.elements_exist(root, elements, proof), "INVALID_ELEMENTS");

    uint256 using_element_count = elements.length;
    bytes32 some_data = 0x0000000000000000000000000000000000000000000000000000000000000001;
    uint256 i;

    while (i < using_element_count) {
      some_data = keccak256(abi.encodePacked(some_data, elements[i]));
      i += 1;
    }

    emit Some_Data(some_data);
  }

  function update_one(
    uint256 index,
    bytes memory element,
    bytes memory update_element,
    bytes32[] memory proof
  ) public {
    root = Merkle_Library_MBS.try_update_one(root, index, element, update_element, proof);
  }

  function update_many(
    bytes[] memory elements,
    bytes[] memory updates_elements,
    bytes32[] memory proof
  ) public {
    root = Merkle_Library_MBS.try_update_many(root, elements, updates_elements, proof);
  }

  function append_one(bytes memory append_element, bytes32[] memory proof) public {
    root = Merkle_Library_MBS.try_append_one(root, append_element, proof);
  }

  function append_many(bytes[] memory append_elements, bytes32[] memory proof) public {
    root = Merkle_Library_MBS.try_append_many(root, append_elements, proof);
  }

  function use_one_and_append_one(
    uint256 index,
    bytes memory element,
    bytes memory append_element,
    bytes32[] memory proof
  ) public {
    root = Merkle_Library_MBS.try_append_one_using_one(root, index, element, append_element, proof);
  }

  function use_one_and_append_many(
    uint256 index,
    bytes memory element,
    bytes[] memory append_elements,
    bytes32[] memory proof
  ) public {
    root = Merkle_Library_MBS.try_append_many_using_one(root, index, element, append_elements, proof);
  }

  function use_many_and_append_one(
    bytes[] memory elements,
    bytes memory append_element,
    bytes32[] memory proof
  ) public {
    root = Merkle_Library_MBS.try_append_one_using_many(root, elements, append_element, proof);
  }

  function use_many_and_append_many(
    bytes[] memory elements,
    bytes[] memory append_elements,
    bytes32[] memory proof
  ) public {
    root = Merkle_Library_MBS.try_append_many_using_many(root, elements, append_elements, proof);
  }

  function update_one_and_append_one(
    uint256 index,
    bytes memory element,
    bytes memory update_element,
    bytes memory append_element,
    bytes32[] memory proof
  ) public {
    root = Merkle_Library_MBS.try_update_one_and_append_one(
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
    bytes memory element,
    bytes memory update_element,
    bytes[] memory append_elements,
    bytes32[] memory proof
  ) public {
    root = Merkle_Library_MBS.try_update_one_and_append_many(
      root,
      index,
      element,
      update_element,
      append_elements,
      proof
    );
  }

  function update_many_and_append_one(
    bytes[] memory elements,
    bytes[] memory update_elements,
    bytes memory append_element,
    bytes32[] memory proof
  ) public {
    root = Merkle_Library_MBS.try_update_many_and_append_one(root, elements, update_elements, append_element, proof);
  }

  function update_many_and_append_many(
    bytes[] memory elements,
    bytes[] memory update_elements,
    bytes[] memory append_elements,
    bytes32[] memory proof
  ) public {
    root = Merkle_Library_MBS.try_update_many_and_append_many(root, elements, update_elements, append_elements, proof);
  }
}
