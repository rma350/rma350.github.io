---
layout: post
title: "Sorting in Parallel in Java with Executors"
date: 2011-12-24 03:05:00
updated: 2015-1-11
---



Sorting an array in Java (version 6 and below) is typically accomplished using `Arrays.sort()`, which runs on a single thread.  In an application where sorting large arrays is a bottleneck, it could be desirable to parallelize this computation.  In this post, we combine the existing Java infrastructure of `ExecutorService` and `Arrays.sort()` to implement a new sorting algorithm.  This algorithm gets a nice speed up from running in parallel, and at the same time gets the benefits of all optimizations in the `Arrays.sort()` implementation, as the bulk of the work is done inside calls to this function.

We will refer to this algorithm as HeavySort.  We give an informal but intuitive description first.  We are given a list \\(A\\) of length \\(n\\) to sort using \\(m\\) threads and a single threaded \\(\mathop{\text{sort}}()\\) implementation.  We split \\(A\\) into \\(m\\) equal sized pieces, denoted \\(B_i\\), and sort each piece with \\(\mathop{\text{sort}}(B_i)\\).  We now want to merge these pieces \\(B_i\\) back together, but in parallel.  We cut \\(B_1\\) into \\(m\\) further equally spaced subsections.  Then for each subsection of \\(B_1\\), letting \\(h\\) be the highest element and \\(\ell\\) be the lowest element (these are at the ends, we can find them in constant time), we can in parallel calculate how many elements from \\(A\\) should be merged with this section, by going through the other pieces \\(B_2,\ldots, B_m\\) and doing binary searches for \\(h\\) and \\(\ell\\).  Finally, once the number of elements that will be merged with each subsection of \\(B_1\\) is known, we can compute their offset in the final array, then run the standard merging procedure in parallel to write the fully sorted results on top of \\(A\\).

We summarize the above with a more formal description below.

Input: An list \\(A\\) of length \\(n\\) to be sorted with \\(m\\) threads, and a non-parallelizable sorting algorithm \\(\mathop{\text{sort}}()\\)

Algorithm:

1. Divide \\(A\\) into \\(m\\) pieces, copy them into new lists \\(B_i\\) for \\(i = 1,\ldots,m\\), and sort them with \\(\mathop{\text{sort}}()\\).
2. Build a list \\(C\\) with first the smallest element of \\(A\\), then \\(m-1\\) points evenly spaced from the interior of \\(B_1\\), then the largest element of \\(A\\).
3. Compute \\(D[i]\\), the number of elements of \\(A\\) that are between \\(C[i]\\) and \\( C[i+1]\\) (use binary searches). 
4. For each \\(i = 1,\ldots,m\\), merge the values of the sorted lists \\(B_1,\ldots,B_m\\) between \\(C[i]\\) and \\(C[i+1]\\).  Copy these values back onto \\(A\\) starting at \\( D[1] + \cdots + D[i-1] \\)

Here is a brief analysis of the the running time.  Step 1 takes \\( O(n/m \log(n/m))\\) for each of \\( m\\) sorts which can be accomplished in parallel.  Step 2 can be accomplished in \\( O(m)\\) time as we can find the largest and smallest elements of \\(A\\) by checking the end points of each \\(B_i\\).  For step 3, we can compute each \\(D[i]\\) in parallel.  For \\( j = 1,\ldots,m\\), we do two binary searches of \\(B_j\\)  for \\(C[i]\\) and \\(C[i+1]\\), taking \\( O(m \log(n/m))\\) in each thread.  For step 4, as <it>should</it> be about \\( n/m\\) elements of \\(A\\) with values between \\(c[i]\\) and \\(c[i+1]\\), and for each element we need to spend \\( O(m)\\) time to determine which of the \\(B_j\\) is next, we can complete step 4 in \\( O(n)\\) using \\( m\\) threads.  Thus the total running time is \\( O(n/m\log(n/m) + n)\\).  Note that for all practical purposes (\\(m \in O(\log n) \\)) this is equal to \\( O(n/m\log(n/m) ) \\), i.e. the running time is dominated by Step 1 and `Arrays.sort()` as desired.  Note that in the final step, performance could be improved by using a binary heap to determine which \\(B_j\\), but \\( m\\) would have to be quite large for this to be practical.

Implicit in this analysis is the assumption that the values in \\(B_1\\) are representative of \\(A\\).  While this assumption would usually be true if \\(A\\) began in uniformly random order, it would be violated if \\(A\\) began sorted or nearly sorted.  When the assumption is violated, the entire merging would be done by a single thread, making step 4 take \\( O(mn)\\).

The algorithm is called `HeavySort` as it uses twice the memory required to store \\(A\\).  The extra memory allocation is only necessary as we try and merge in parallel, as is step 3.  Since for small \\( m\\), the sorting in step 1 will be dominant, it would be interesting to see if the cost of making the memory allocation and the binary searches in step 3 are actually saved by parallelizing the merging.

My objective while designing this algorithm was that it would be easy to implement the sorting with Java's built in Arrays.sort(), and the parallelization with Java's ExecutorService.  The algorithm is implemented in a single class that can be dropped into any Java project, version 1.5 or greater.  Below is the source code, JUnit tests, and an example.  In practice, I had a 3-4x speedup over `Arrays.sort()` using 6 threads.  The source can be downloaded [here](../../../assets/posts/sorting-in-parallel-in-java-with-executors/javaHeavySort.zip).

{% highlight java %}
package parallelSorting;

import java.util.Arrays;
import java.util.Collections;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import parallelSorting.HeavySort.ArrayFactory;

public class HeavySortMain {
  
  public static void main(String [] args){
    int  problemSize = 200000000;
    int numThreads = 6;
    Random random = new Random();
    Integer[] sortArray = new Integer[problemSize];
    for (int i=0; i< problemSize ;i++){
      sortArray[i] = random.nextInt(Integer.MAX_VALUE );
    }
    long startTime2 = System.currentTimeMillis();
    Arrays.sort(sortArray);
    System.out.println("Single Threaded Sort: time taken " + 
        (System.currentTimeMillis() - startTime2));
    Collections.shuffle(Arrays.asList(sortArray));
    final ExecutorService executor = Executors.newFixedThreadPool(numThreads);
    long startTime = System.currentTimeMillis();
    ArrayFactory<Integer> factory = new ArrayFactory<Integer>(){

      @Override
      public Integer[] buildArray(int length) {
        return new Integer[length];
      }

    };
    HeavySort.sort(sortArray,executor,numThreads,factory);
    System.out.println("Multi-Threaded sort: time taken " + 
        (System.currentTimeMillis() - startTime));
    

    for (int i=0; i<sortArray.length-1; i++){
      if(sortArray[i] > sortArray[i+1]){
        System.err.println("Error: element at " + i 
            + " : " + sortArray[i]  );
        System.err.println("Error: element at " + 
            (i+1) + " : " + sortArray[i+1]  );
      }

    }
    executor.shutdown();
  }

}
{% endhighlight %}

{% highlight java %}
package parallelSorting;


import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;

public class HeavySort {

  private static boolean noisy = true;
  
  public static <T extends Comparable<T>> void sort(T[] data, 
      ExecutorService service, int numThreads, 
      ArrayFactory<T> arrayFactory){
    if(data.length <= 1){
      return;
    }
    List<Callable<Boolean>> tasks = new ArrayList<Callable<Boolean>>();
    int[] startingPoints = new int[numThreads];
    for(int i = 0; i < numThreads;i++){
      int lo = data.length*i/numThreads;
      startingPoints[i] = lo;
      int hi = data.length*(i+1)/numThreads;
      tasks.add(new SortSubsequence<T>(data,lo,hi));
    }
    long sortingTime = System.currentTimeMillis();
    try {
      List<Future<Boolean>> results = service.invokeAll(tasks);
      for(Future<Boolean> result: results){
        if(!result.get().booleanValue()){
          throw new RuntimeException();
        }
      }
    } catch (InterruptedException e) {
      throw new RuntimeException(e);
    } catch (ExecutionException e) {
      throw new RuntimeException(e);
    }
    if(noisy){
      System.out.println("Sorting Time " + 
          (System.currentTimeMillis() - sortingTime));
    }
    List<T> dividers = new ArrayList<T>();
    int hi = data.length/numThreads;
    dividers.add(null);
    for(int i = 1; i < numThreads; i++){
      dividers.add(data[(hi*i)/numThreads]);
    }
    dividers.add(null);
    List<Callable<T[]>> merges = new ArrayList<Callable<T[]>>();
    for(int i = 0 ; i < numThreads; i++){
      merges.add(new MergeSubsequences<T>(dividers.get(i),
          dividers.get(i+1),data,startingPoints,arrayFactory));
    }
    List<T[]> resultsCollected = new ArrayList<T[]>();
    long mergingTime = System.currentTimeMillis();
    try {
      List<Future<T[]>> results = service.invokeAll(merges);
      for(Future<T[]> result: results){
        resultsCollected.add(result.get());
      }
    } catch (InterruptedException e) {
      throw new RuntimeException(e);
    } catch (ExecutionException e) {
      throw new RuntimeException(e);
    }
    if(noisy){
      System.out.println("Merging Time " + 
          (System.currentTimeMillis() - mergingTime));
    }
    List<Callable<Boolean>> pastes = new ArrayList<Callable<Boolean>>();
    int startingPoint = 0;
    for(int i = 0 ; i < numThreads; i++){
      pastes.add(new Paste<T>(startingPoint, 
          data,resultsCollected.get(i)));
      startingPoint+= resultsCollected.get(i).length;
    }
    long pastingTime = System.currentTimeMillis();
    try {
      List<Future<Boolean>> pastesResults = service.invokeAll(pastes);
      for(Future<Boolean> result: pastesResults){
        if(!result.get().booleanValue()){
          throw new RuntimeException();
        }
      }
    } catch (InterruptedException e) {
      throw new RuntimeException(e);
    } catch (ExecutionException e) {
      throw new RuntimeException(e);
    }
    if(noisy){
      System.out.println("Pasting Time " + 
          (System.currentTimeMillis() - pastingTime));
    }
  }

  public static interface ArrayFactory<T extends Comparable<T>>{
    public T[] buildArray(int length);
  }

  private static class Paste<T extends Comparable<T>> implements
      Callable<Boolean>{

    private int lo;
    private T[] data;
    private T[] source;

    public Paste(int lo, T[] data, T[] source) {
      super();
      this.lo = lo;
      this.data = data;
      this.source = source;
    }

    @Override
    public Boolean call() throws Exception {
      System.arraycopy(source, 0, data, lo, source.length);
      return Boolean.valueOf(true);
    }
  }

  private static class MergeSubsequences<T extends Comparable<T>> implements
      Callable<T[]>{

    private T lo;
    private T hi;
    private T[] data;
    private int[] startingPoints;
    private int[] endPoints;
    private ArrayFactory<T> arrayFactory;

    public MergeSubsequences(T lo, T hi, T[] data, 
        int[] startingPoints, ArrayFactory<T> arrayFactory) {
      super();
      this.arrayFactory = arrayFactory;
      this.lo = lo;
      this.hi = hi;
      this.data = data;
      this.startingPoints = startingPoints;
      this.endPoints = new int[startingPoints.length];
      for(int i = 0; i < startingPoints.length-1; i++){
        endPoints[i] = startingPoints[i+1];
      }
      endPoints[endPoints.length-1] = data.length;
    }

    @Override
    public T[] call() throws Exception {

      int[] currentLocationBySection = Arrays.copyOf(
          startingPoints, startingPoints.length);
      int[] upperBoundsBySection = Arrays.copyOf(
          endPoints, endPoints.length);

      if(lo != null){
        for(int i = 0; i < currentLocationBySection.length; i++){
          currentLocationBySection[i] = Arrays.binarySearch(
              data, startingPoints[i], endPoints[i], lo);
          if(currentLocationBySection[i] < 0){
            currentLocationBySection[i] = 
              -currentLocationBySection[i] - 1;
          }
        }
      }
      if(hi != null){
        for(int i = 0; i < upperBoundsBySection.length; i++){
          upperBoundsBySection[i] = Arrays.binarySearch(
              data, startingPoints[i], endPoints[i], hi);
          if(upperBoundsBySection[i] < 0){
            upperBoundsBySection[i] = 
              -upperBoundsBySection[i] - 1;
          }
        }
      }
      boolean[] sectionsInBounds = 
        new boolean[currentLocationBySection.length];
      Arrays.fill(sectionsInBounds, true);
      int numSectionsInBounds = sectionsInBounds.length;
      int totalItems = 0;
      for(int i = 0; i < sectionsInBounds.length; i++){
        if(currentLocationBySection[i] >= upperBoundsBySection[i]){
          sectionsInBounds[i] = false;
          numSectionsInBounds--;
        }
        else{
          totalItems += upperBoundsBySection[i] -
          currentLocationBySection[i];
        }    
      }
      T[] ans = arrayFactory.buildArray(totalItems);
      int ansInd = 0;
      while(numSectionsInBounds > 0){
        int bestSection = -1;
        T best = null;
        for(int i = 0; i < sectionsInBounds.length; i++){
          if(sectionsInBounds[i]){
            if(best == null || 
                data[currentLocationBySection[i]].compareTo(best)
                < 0){
              bestSection = i;
              best = data[currentLocationBySection[i]];
            }
          }        
        }        
        ans[ansInd] = best;
        ansInd++;
        currentLocationBySection[bestSection]++;
        if(currentLocationBySection[bestSection] 
                                    >= upperBoundsBySection[bestSection]){
          sectionsInBounds[bestSection] = false;
          numSectionsInBounds--;
        }
      }
      return ans;
    }
  }

  private static class SortSubsequence<T extends Comparable<T>> implements
      Callable<Boolean>{

    private T[] data;
    private int lo;
    private int hi;

    public SortSubsequence(T[] data, int lo, int hi) {
      super();
      this.data = data;
      this.lo = lo;
      this.hi = hi;
    }

    @Override
    public Boolean call() throws Exception {
      Arrays.sort(data,lo,hi);
      return Boolean.valueOf(true);
    }
  }
}
{% endhighlight %}

{% highlight java %}
package parallelSorting;

import static org.junit.Assert.*;

import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.junit.Test;

import parallelSorting.HeavySort.ArrayFactory;

public class HeavySortTest {
  
  private static ArrayFactory<Integer> integerArrayFactory = 
    new ArrayFactory<Integer>(){
      @Override
      public Integer[] buildArray(int length) {
        return new Integer[length];
      }      
    };
    
    private static Integer[] zeroArray(){
      return new Integer[0];
    }
    
    private static Integer[] oneArray(){
      return new Integer[]{Integer.valueOf(-12)};
    }
    
    private static Integer[] twoArray(){
      return new Integer[]{Integer.valueOf(300), Integer.valueOf(100)};
    }
    
    private static Integer[] threeArray(){
      return new Integer[]{Integer.valueOf(-10), 
          Integer.valueOf(-5), Integer.valueOf(-1)};
    }    
    
    private static Integer[] nineArray(){
      return new Integer[]{14, 4 ,100,140,-4,8,30,4,-20 };
    }    

  @Test
  public void test() {
    for(int i : new int[]{1,3,4,5,8,10}){
      ExecutorService exec = Executors.newFixedThreadPool(i);
      {
        Integer[] zero = zeroArray();
        HeavySort.sort(zero, exec, i, integerArrayFactory);
        Integer[] ans = zeroArray();
        Arrays.sort(ans);
        assertArrayEquals(ans,zero);
      }
      {
        Integer[] one = oneArray();
        HeavySort.sort(one, exec, i, integerArrayFactory);
        Integer[] ans = oneArray();
        Arrays.sort(ans);
        assertArrayEquals(ans,one);
      }
      {
        Integer[] two = twoArray();
        HeavySort.sort(two, exec, i, integerArrayFactory);
        Integer[] ans = twoArray();
        Arrays.sort(ans);
        assertArrayEquals(ans,two);
      }
      {
        Integer[] three = threeArray();
        HeavySort.sort(three, exec, i, integerArrayFactory);
        Integer[] ans = threeArray();
        Arrays.sort(ans);
        assertArrayEquals(ans,three);
      }
      {
        Integer[] nine = nineArray();
        HeavySort.sort(nine, exec, i, integerArrayFactory);
        Integer[] ans = nineArray();
        Arrays.sort(ans);
        assertArrayEquals(ans,nine);
      }
    }
  }
}
{% endhighlight %}