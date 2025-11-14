/*
Copyright 2025.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUTHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// RLEnvironmentSpec defines the desired state of RLEnvironment
type RLEnvironmentSpec struct {
	// Image is the container image for the RL environment.
	// +kubebuilder:validation:Required
	Image string `json:"image"`

	// Replicas is the desired number of pods. Defaults to 1.
	// +kubebuilder:validation:Optional
	// +kubebuilder:default:=1
	Replicas *int32 `json:"replicas,omitempty"`

	// HPASpec defines the Horizontal Pod Autoscaler configuration.
	// +kubebuilder:validation:Optional
	HPASpec *HPASpec `json:"hpaSpec,omitempty"`
}

// HPASpec defines the HPA configuration.
type HPASpec struct {
	MinReplicas *int32 `json:"minReplicas"`
	MaxReplicas int32  `json:"maxReplicas"`
	// +kubebuilder:validation:Optional
	TargetCPUUtilizationPercentage *int32 `json:"targetCPUUtilizationPercentage,omitempty"`
}

// RLEnvironmentStatus defines the observed state of RLEnvironment
type RLEnvironmentStatus struct {
	// PodNames are the names of the pods running the environment.
	PodNames []string `json:"podNames,omitempty"`

	// ReadyReplicas is the number of ready pods.
	ReadyReplicas int32 `json:"readyReplicas,omitempty"`

	// Conditions represent the latest available observations of an object's state.
	Conditions []metav1.Condition `json:"conditions,omitempty"`
}

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status

// RLEnvironment is the Schema for the rlenvironments API
type RLEnvironment struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   RLEnvironmentSpec   `json:"spec,omitempty"`
	Status RLEnvironmentStatus `json:"status,omitempty"`
}

//+kubebuilder:object:root=true

// RLEnvironmentList contains a list of RLEnvironment
type RLEnvironmentList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []RLEnvironment `json:"items"`
}

func init() {
	SchemeBuilder.Register(&RLEnvironment{}, &RLEnvironmentList{})
}