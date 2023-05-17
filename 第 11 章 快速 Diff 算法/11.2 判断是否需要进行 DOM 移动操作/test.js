function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] < target) {
      left = mid + 1;
    } else if (arr[mid] > target) {
      right = mid - 1;
    } else {
      return mid;
    }
  }

  return left;
}

function findLIS(nums) {
  const n = nums.length;
  const dp = new Array(n);
  const lis = [];

  for (let i = 0; i < n; i++) {
    const num = nums[i];
    const index = binarySearch(lis, num);

    dp[i] = index;
    if (index === lis.length) {
      lis.push(num);
    } else {
      lis[index] = num;
    }
  }

  const maxLength = lis.length;
  const result = [];
  let currentIndex = maxLength - 1;

  for (let i = n - 1; i >= 0; i--) {
    if (dp[i] === currentIndex) {
      result.unshift(i);
      currentIndex--;
    }
  }

  return result;
}

// 示例用法
const nums = [3, 4, 2, 8, 10, 5, 1];
const lisIndices = findLIS(nums);
console.log(lisIndices); // 输出: [0, 1, 3, 4]

