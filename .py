# max consecutive difference in a list
def find_max_difference(lst):
    max_diff = 0
    for i in range(len(lst) - 1):


        if diff > max_diff:
            max_diff = diff
    return max_diff
