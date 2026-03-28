import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface SegmentedControlProps {
  segments: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  variant?: 'primary' | 'hero';
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  segments,
  selectedIndex,
  onChange,
  variant = 'primary',
}) => {
  return (
    <View style={styles.container}>
      {segments.map((segment, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.segment,
            selectedIndex === index && (
              variant === 'hero' ? styles.selectedSegmentHero : styles.selectedSegment
            ),
          ]}
          onPress={() => onChange(index)}
        >
          <Text
            style={[
              styles.segmentText,
              selectedIndex === index && (
                variant === 'hero' ? styles.selectedSegmentTextHero : styles.selectedSegmentText
              ),
            ]}
          >
            {segment}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.gray ? Colors.gray[100] : '#f3f4f6',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSegment: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedSegmentHero: {
    backgroundColor: Colors.heroPrimary,
    borderRadius: 8,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray ? Colors.gray[500] : '#6b7280',
  },
  selectedSegmentText: {
    color: Colors.text,
    fontWeight: '600',
  },
  selectedSegmentTextHero: {
    color: Colors.white,
    fontWeight: '600',
  },
});

export default SegmentedControl;